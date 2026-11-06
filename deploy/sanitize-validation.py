#!/usr/bin/env python3
"""Remove private records and Git objects before validating imported source.

This script and the calling workflow are protected from automatic public
imports. Run it only on an ephemeral validation checkout, never a release or
developer checkout.
"""
import os
from pathlib import Path
import shutil


def sanitize_checkout(directory):
    root = Path(directory).resolve()
    for relative in ['.git', 'deploy/private', '.github/private-sync', 'OPEN_SOURCE_READINESS.md']:
        path = root / relative
        if not path.parent.resolve().is_relative_to(root):
            raise RuntimeError(f'Validation path escapes the checkout: {relative}')
        if path.is_symlink() or path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)


if __name__ == '__main__':
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise SystemExit('Only run this on an ephemeral GitHub Actions validation checkout')
    sanitize_checkout(os.environ['GITHUB_WORKSPACE'])
