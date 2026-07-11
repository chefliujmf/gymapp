#!/usr/bin/env bash
# GIT_ASKPASS helper for the XPS bug-worker. Git calls this for the password prompt when pushing to
# https://x-access-token@github.com/... — we answer with the reused GH_PROMOTE_TOKEN (injected by systemd
# from the root-owned env file, so it never sits on jmf-readable disk). The prompt text arrives on $1; ignore it.
echo "${GH_PROMOTE_TOKEN:-}"
