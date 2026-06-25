#!/usr/bin/env python3
"""Inspect Centr and collect candidate workouts for the coach plan.

Credentials are read from CENTR_EMAIL and CENTR_PASSWORD.
Browser session state is stored in .secrets/centr_state.json.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from coach_env import load_local_env_files
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

STATE_PATH = Path(".secrets/centr_state.json")
LOCAL_ENV_PATHS = (
    Path(".secrets/coach.env"),
    Path(".secrets/centr.env"),
)


async def click_first_visible(page, labels: list[str], timeout: int = 2500) -> bool:
    for label in labels:
        candidates = [
            page.get_by_role("button", name=label),
            page.get_by_role("link", name=label),
            page.get_by_text(label, exact=False),
        ]
        for candidate in candidates:
            try:
                await candidate.first.click(timeout=timeout)
                return True
            except PlaywrightTimeoutError:
                continue
            except Exception:
                continue
    return False


async def login_if_needed(page, email: str, password: str) -> None:
    await page.goto("https://centr.com/auth/login", wait_until="domcontentloaded")
    await page.wait_for_timeout(2000)

    if "login" not in page.url.lower() and "signin" not in page.url.lower():
        return

    email_inputs = [
        page.locator("input[name='loginId']"),
        page.get_by_label("Email"),
        page.locator("input[placeholder*='Email' i]"),
        page.locator("input[type='email']"),
        page.locator("input[name*='email' i]"),
    ]
    password_inputs = [
        page.locator("input[name='password']"),
        page.get_by_label("Password"),
        page.locator("input[placeholder*='Password' i]"),
        page.locator("input[type='password']"),
        page.locator("input[name*='password' i]"),
    ]

    for locator in email_inputs:
        try:
            await locator.first.fill(email, timeout=3000)
            break
        except PlaywrightTimeoutError:
            continue

    for locator in password_inputs:
        try:
            await locator.first.fill(password, timeout=3000)
            break
        except PlaywrightTimeoutError:
            continue

    try:
        await page.locator("button:has-text('CONTINUE')").last.click(timeout=5000)
    except PlaywrightTimeoutError:
        clicked = await click_first_visible(page, ["CONTINUE", "Continue", "Log in", "Login", "Sign in"])
        if not clicked:
            await page.locator("input[name='password']").first.press("Enter", timeout=3000)

    await page.wait_for_load_state("domcontentloaded")
    await page.wait_for_timeout(5000)


async def collect_candidates(page) -> None:
    search_terms = [
        "mobility",
        "yoga",
        "pilates",
        "recovery",
        "core",
        "strength",
    ]
    urls = [
        "https://centr.com/auth/login",
        "https://centr.com/app",
        "https://centr.com/workouts",
        "https://centr.com/programs",
    ]

    seen: set[str] = set()
    for url in urls:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        except Exception:
            continue
        await page.wait_for_timeout(3000)
        text = await page.locator("body").inner_text(timeout=5000)
        print(f"\n## PAGE {page.url}\n")
        for line in text.splitlines():
            cleaned = " ".join(line.split())
            if not cleaned or cleaned in seen:
                continue
            lowered = cleaned.lower()
            if any(term in lowered for term in search_terms):
                seen.add(cleaned)
                print(f"- {cleaned}")


async def main() -> int:
    load_local_env_files(LOCAL_ENV_PATHS)
    email = os.environ.get("CENTR_EMAIL")
    password = os.environ.get("CENTR_PASSWORD")
    if not email or not password:
        raise SystemExit("Set CENTR_EMAIL and CENTR_PASSWORD.")

    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context_kwargs = {}
        if STATE_PATH.exists():
            context_kwargs["storage_state"] = str(STATE_PATH)
        context = await browser.new_context(**context_kwargs)
        page = await context.new_page()
        await login_if_needed(page, email, password)
        await context.storage_state(path=str(STATE_PATH))
        await collect_candidates(page)
        await browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
