#!/usr/bin/env python3
"""Validate the repository's portable OpenAI plugin package."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "plugin.json"
COMPAT_MANIFEST = ROOT / ".codex-plugin" / "plugin.json"
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing {path.relative_to(ROOT)}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def require_text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{label} must be a non-empty string")
    if "[TODO" in value or "<TODO" in value:
        fail(f"{label} contains a placeholder")
    return value


def require_https(value: object, label: str) -> str:
    text = require_text(value, label)
    parsed = urlparse(text)
    if parsed.scheme != "https" or not parsed.netloc:
        fail(f"{label} must be an absolute HTTPS URL")
    return text


manifest = load_json(MANIFEST)
if manifest.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
    fail("plugin.json must declare the Agent Plugins 1.0.0 schema")

name = require_text(manifest.get("name"), "name")
if not NAME_RE.fullmatch(name):
    fail("name must be lower-case kebab-case")
version = require_text(manifest.get("version"), "version")
if not SEMVER_RE.fullmatch(version):
    fail("version must be valid semantic versioning")
require_text(manifest.get("description"), "description")
require_text(manifest.get("author", {}).get("name"), "author.name")
require_https(manifest.get("author", {}).get("url"), "author.url")
for field in ("homepage", "repository"):
    require_https(manifest.get(field), field)

openai = manifest.get("extensions", {}).get("com.openai")
if not isinstance(openai, dict):
    fail("extensions.com.openai must be an object")
interface = openai.get("interface")
if not isinstance(interface, dict):
    fail("extensions.com.openai.interface must be an object")

for field in (
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
):
    require_text(interface.get(field), f"interface.{field}")
for field in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
    require_https(interface.get(field), f"interface.{field}")

prompts = interface.get("defaultPrompt")
if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3:
    fail("interface.defaultPrompt must contain 1 to 3 prompts")
for index, prompt in enumerate(prompts):
    text = require_text(prompt, f"interface.defaultPrompt[{index}]")
    if len(text) > 128:
        fail(f"interface.defaultPrompt[{index}] exceeds 128 characters")

for field in ("composerIcon", "logo", "logoDark"):
    relative = interface.get(field)
    if relative is None:
        continue
    value = require_text(relative, f"interface.{field}")
    if not value.startswith("./assets/"):
        fail(f"interface.{field} must point under ./assets/")
    target = (ROOT / value.removeprefix("./")).resolve()
    if ROOT not in target.parents or not target.is_file():
        fail(f"interface.{field} points to a missing or unsafe path")

skill_manifests = sorted((ROOT / "skills").glob("*/SKILL.md"))
if not skill_manifests:
    fail("skills/ must contain at least one */SKILL.md")
for skill_manifest in skill_manifests:
    text = skill_manifest.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\nname:" not in text or "\ndescription:" not in text:
        fail(f"invalid skill frontmatter in {skill_manifest.relative_to(ROOT)}")

compat = load_json(COMPAT_MANIFEST)
for field in ("name", "version", "description"):
    if compat.get(field) != manifest.get(field):
        fail(f"compatibility manifest {field} differs from root plugin.json")
if compat.get("interface") != interface:
    fail("compatibility manifest interface differs from root plugin.json")

print(f"OpenAI plugin package is valid: {name}@{version} ({len(skill_manifests)} skill)")
