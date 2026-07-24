import json, urllib.request, subprocess
B="http://localhost:8089"; TOK="simtok-strength"; D="2026-08-15"; D2="2026-08-16"
def call(method, path, body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+path, data=data, method=method,
        headers={"Authorization":"Bearer "+TOK,"Content-Type":"application/json"})
    try:
        r=urllib.request.urlopen(req, timeout=10); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
    except Exception as e: return 0, str(e)
# clear rest markers + plans on test dates
for d in (D,D2): call("POST","/api/rest-day",{"date":d,"rest":False})
ride=lambda date,pin=None: {"id":"pintest1","date":date,"sport":"ride","title":"Pinned Easy Ride",
    **({"pinned":pin} if pin is not None else {}),
    "segments":[{"label":"Endurance","duration":1800,"powerStart":60,"powerEnd":60}]}
s,b=call("POST","/api/plan",ride(D,True)); print("setup create:",s,"pinned=",json.loads(b).get("pinned") if s<400 else b[:80])
s,_=call("POST","/api/plan",ride(D2)); print("T1 coach MOVE   (expect 409):",s)
s,_=call("DELETE","/api/plan/pintest1"); print("T2 coach REMOVE (expect 409):",s)
s,_=call("POST","/api/rest-day",{"date":D,"rest":True}); print("T3 coach REST   (expect 409):",s)
s,_=call("POST","/api/plan",ride(D,False)); print("T4a release pin (expect 2xx):",s)
s,_=call("POST","/api/plan",ride(D2)); print("T4b move after  (expect 2xx):",s)
for d in (D,D2): call("DELETE","/api/plan/pintest1")
