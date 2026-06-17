import os
import json
import time
import requests
from urllib.parse import quote

# --- Config ---------------------------------------------------------------
BASE = 'https://centr.com'
RECIPE_LIST = (BASE + '/api/v5.0/w/library/recipes?query={query}&favourites=false'
               '&recipeGender=2&goal=2&recipeMeal=2&isSubscribed=true&region=2'
               '&pageNumber={page}&workoutLevel=1')
RECIPE_DETAIL = BASE + '/api/v5.0/w/library/recipes/{content_id}'
ARTICLE_LIST = (BASE + '/api/v5.0/w/library/articles?query={query}&favourites=false'
                '&pageNumber={page}&workoutLevel=3&region=2')
ARTICLE_DETAIL = BASE + '/api/v5.0/w/library/articles/{content_id}'
WORKOUT_LIST = (BASE + '/api/v5.0/w/library/workouts?query={query}&favourites=false'
                '&pageNumber={page}&workoutLevel=3&region=2')
WORKOUT_DETAIL = BASE + '/api/v5.0/w/library/workouts/{content_id}'

# kind: 'json'  -> save detail JSON (+ hero image); 'audio' -> save detail JSON + media mp3s.
# The API under-reports totals, so we union across passes toward `expected`.
COLLECTIONS = [
    {'name': 'recipes',    'kind': 'json',  'subdir': 'recipes',    'expected': 578,
     'list': RECIPE_LIST,  'detail': RECIPE_DETAIL,  'query': 'and%28130%29+not%2814%29', 'units': True},
    {'name': 'snacks',     'kind': 'json',  'subdir': 'snacks',     'expected': 272,
     'list': RECIPE_LIST,  'detail': RECIPE_DETAIL,  'query': 'and%28130%2C14%29',        'units': True},
    {'name': 'meditation', 'kind': 'audio', 'subdir': 'meditation', 'expected': 257,
     'list': ARTICLE_LIST, 'detail': ARTICLE_DETAIL, 'query': 'and%28132%29',             'units': False},
    {'name': 'workouts',   'kind': 'json',  'subdir': 'workouts',   'expected': 226,
     'list': WORKOUT_LIST, 'detail': WORKOUT_DETAIL, 'query': 'not%28636%29',             'units': False},
]

HERO_PRIORITY = [
    'landscapewidedesktop3x', 'landscapewidedesktop2x', 'landscapewidedesktop1x',
    'landscape32medium3x', 'landscape32medium2x', 'landscape32medium1x',
    'landscape32small3x', 'landscape32small2x', 'landscape32small1x',
]

PRIMARY_UNITS = {0: 'whole', 1: 'g', 2: 'ml', 3: 'tsp', 8: 'bunch', 11: 'sprig', 13: 'sheet'}
ALT_UNITS = {0: 'whole', 3: 'tsp', 5: 'tbsp', 7: 'cup', 8: 'cup'}

DELAY = 1.5          # delay between API/JSON requests (avoid 401 rate-limit)
AUDIO_DELAY = 12     # extra-long pause between large audio downloads
MAX_RETRIES = 5
RETRY_WAIT = 30
MAX_PASSES = 10      # union passes per collection
PASS_WAIT = 20
CONVERGE_PASSES = 2  # stop early if this many passes in a row add nothing new
GLOBAL_ATTEMPTS = 3  # whole-run retries (mainly to re-attempt failed downloads)
GLOBAL_WAIT = 120
MAX_ITEMS = int(os.environ.get('SCRAPER_MAX', '0'))  # 0 = no limit


def make_session(token):
    s = requests.Session()
    h = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
         'Accept': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token.replace('Bearer ', '')
    s.headers.update(h)
    return s


def get_json(session, url):
    for _ in range(MAX_RETRIES):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 200 and 'json' in r.headers.get('content-type', ''):
                return json.loads(r.content.decode('utf-8-sig'))
            if r.status_code in (401, 429) or r.status_code >= 500:
                time.sleep(RETRY_WAIT); continue
            return None
        except requests.RequestException:
            time.sleep(RETRY_WAIT)
    return None


def pick_hero(image_list):
    if not isinstance(image_list, dict):
        return None
    for k in HERO_PRIORITY:
        e = image_list.get(k)
        if e and e.get('url'):
            return e['url']
    for e in image_list.values():
        if isinstance(e, dict) and e.get('url'):
            return e['url']
    return None


def add_readable_units(obj):
    if isinstance(obj, dict):
        if 'unitType' in obj and 'quantity' in obj:
            obj['unit'] = PRIMARY_UNITS.get(obj['unitType'], f"unitType{obj['unitType']}")
            alt, factor = obj.get('alternateUnitType'), obj.get('alternateFactorAmount') or 0
            if alt not in (None, -1) and factor:
                obj['alternateUnit'] = ALT_UNITS.get(alt, f'altUnitType{alt}')
                obj['alternateQuantityComputed'] = round(obj['quantity'] * factor, 3)
        for v in obj.values():
            add_readable_units(v)
    elif isinstance(obj, list):
        for v in obj:
            add_readable_units(v)
    return obj


def download_file(url, path):
    """Stream a binary file to disk, with retries. safe=':/%' avoids double-
    encoding URLs that already contain %20 (the cause of earlier 404s)."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    for attempt in range(MAX_RETRIES):
        try:
            with requests.get(quote(url, safe=':/%'), headers={'User-Agent': 'Mozilla/5.0'},
                              stream=True, timeout=120) as r:
                r.raise_for_status()
                tmp = path + '.part'
                with open(tmp, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
                os.replace(tmp, path)
            return True
        except Exception as e:
            msg = str(e)
            print(f'    download failed (attempt {attempt+1}): {msg[:120]}')
            if '404' in msg:   # missing blob won't appear on retry
                return False
            time.sleep(RETRY_WAIT)
    return False


def collect_pass(session, col):
    """One pagination pass. Stops at the first empty page (the API serves
    nothing past its real end, regardless of the reported totalPages)."""
    items, page = [], 1
    while True:
        j = get_json(session, col['list'].format(query=col['query'], page=page))
        if not j:
            break
        res = j.get('result') or {}
        contents = res.get('contents') or []
        if not contents:
            break
        for it in contents:
            entry = {'contentId': it.get('contentId'), 'slug': it.get('urlPartial'),
                     'title': it.get('title')}
            if col['kind'] == 'audio':
                entry['media'] = [m['value'] for m in (it.get('media') or [])
                                  if str(m.get('value', '')).lower().endswith(('.mp3', '.m4a', '.aac'))]
            else:
                entry['heroImage'] = pick_hero(it.get('imageList'))
            items.append(entry)
        page += 1
        time.sleep(DELAY)
    return items


def collect_until(session, col):
    by_id, no_gain = {}, 0
    for p in range(1, MAX_PASSES + 1):
        before = len(by_id)
        for it in collect_pass(session, col):
            if it.get('contentId') is not None:
                by_id[it['contentId']] = it
        gain = len(by_id) - before
        print(f'  pass {p}: {len(by_id)} unique (+{gain}, expected {col["expected"]})')
        if col['expected'] and len(by_id) >= col['expected']:
            break
        no_gain = no_gain + 1 if gain == 0 else 0
        if no_gain >= CONVERGE_PASSES:
            print(f'  converged at {len(by_id)} (API caps below {col["expected"]})')
            break
        if p < MAX_PASSES:
            time.sleep(PASS_WAIT)
    return list(by_id.values())


def enrich_existing(d):
    if not os.path.isdir(d):
        return
    for n in os.listdir(d):
        if n.endswith('.json') and not n.startswith('_'):
            p = os.path.join(d, n)
            with open(p, encoding='utf-8') as f:
                data = json.load(f)
            add_readable_units(data)
            with open(p, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)


def download_collection(session, col, items, out_root):
    sub = os.path.join(out_root, col['subdir'])
    json_dir = sub
    media_dir = os.path.join(out_root, col['subdir'] + ('_audio' if col['kind'] == 'audio' else '_images'))
    os.makedirs(json_dir, exist_ok=True)
    os.makedirs(media_dir, exist_ok=True)
    if MAX_ITEMS:
        items = items[:MAX_ITEMS]
    total = len(items)
    for i, it in enumerate(items, 1):
        slug = it['slug'] or f'{col["name"]}_{it["contentId"]}'
        jp = os.path.join(json_dir, f'{slug}.json')
        if not os.path.exists(jp):
            d = get_json(session, col['detail'].format(content_id=it['contentId']))
            if d:
                if col['units']:
                    add_readable_units(d)
                with open(jp, 'w', encoding='utf-8') as f:
                    json.dump(d, f, ensure_ascii=False, indent=2)
            else:
                print(f'  [{i}/{total}] detail failed: {slug}')
        if col['kind'] == 'audio':
            for n, url in enumerate(it.get('media', [])):
                ext = os.path.splitext(url.split('?')[0])[1] or '.mp3'
                name = f'{slug}{ext}' if len(it['media']) == 1 else f'{slug}_{n+1}{ext}'
                print(f'  [{i}/{total}] {it["title"]} -> {name}')
                download_file(url, os.path.join(media_dir, name))
            time.sleep(AUDIO_DELAY)
        else:
            if it.get('heroImage'):
                ext = os.path.splitext(it['heroImage'].split('?')[0])[1] or '.jpg'
                download_file(it['heroImage'], os.path.join(media_dir, f'{slug}{ext}'))
            if i % 25 == 0 or i == total:
                print(f'  -> {i}/{total}')
            time.sleep(DELAY)


def missing_count(col, items, out_root):
    """How many JSON details are still not on disk (the retry signal)."""
    sub = os.path.join(out_root, col['subdir'])
    return sum(1 for it in items
               if not os.path.exists(os.path.join(sub, f'{it["slug"] or col["name"]+"_"+str(it["contentId"])}.json')))


def run_once(session, out_root, cols):
    status = {}
    for col in cols:
        print(f'\n=== {col["name"]} ({col["kind"]}) ===')
        sub = os.path.join(out_root, col['subdir'])
        os.makedirs(sub, exist_ok=True)
        if col['units']:
            enrich_existing(sub)

        items = collect_until(session, col)
        # Merge with prior index so we never lose previously-found items.
        idx = os.path.join(sub, '_index.json')
        if os.path.exists(idx):
            try:
                prev = {i['contentId']: i for i in json.load(open(idx, encoding='utf-8'))}
                for it in items:
                    prev[it['contentId']] = it
                items = list(prev.values())
            except Exception:
                pass
        with open(idx, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

        print(f'  downloading {len(items)} items')
        download_collection(session, col, items, out_root)
        miss = missing_count(col, items, out_root)
        status[col['name']] = {'collected': len(items), 'missing': miss}
        print(f'  {col["name"]}: {len(items)} collected, {miss} JSON still missing')
    return status


def main():
    out_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloaded_pages')
    os.makedirs(out_root, exist_ok=True)
    session = make_session(os.environ.get('CENTR_TOKEN'))

    only = os.environ.get('SCRAPER_ONLY')  # e.g. SCRAPER_ONLY=workouts
    cols = [c for c in COLLECTIONS if not only or c['name'] in only.split(',')]
    print('Collections this run:', ', '.join(c['name'] for c in cols))

    for attempt in range(1, GLOBAL_ATTEMPTS + 1):
        print(f'\n######## ATTEMPT {attempt}/{GLOBAL_ATTEMPTS} ########')
        status = run_once(session, out_root, cols)
        summary = ', '.join(f'{n} {s["collected"]}(-{s["missing"]})' for n, s in status.items())
        print(f'\n--- attempt {attempt}: {summary} ---')
        if all(s['missing'] == 0 for s in status.values()):
            print('No missing downloads — done.')
            break
        if attempt < GLOBAL_ATTEMPTS:
            print(f'Retrying missing in {GLOBAL_WAIT}s...')
            time.sleep(GLOBAL_WAIT)

    print('\nAll done.')


if __name__ == '__main__':
    main()
