#!/usr/bin/env python3
"""Package the registered kit, real inspection exports and SHA-256 inventory."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspection', type=Path, default=ROOT / 'inspection')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--proof-output', type=Path)
    args = parser.parse_args()
    inspection = args.inspection.resolve()
    assert len(list((inspection / 'images').glob('*.png'))) == 50
    assert len(list((inspection / 'json').glob('*.json'))) == 50
    files = []
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if '__pycache__' in relative.parts or relative.parts[0] in ['Review', 'inspection']:
            continue
        if path.suffix == '.tmp' or path.resolve() == args.output.resolve():
            continue
        files.append((path, str(relative)))
    files.extend((p, str(Path('inspection') / p.relative_to(inspection)))
                 for p in sorted(inspection.rglob('*')) if p.is_file())
    proof_files = [(p, rel) for p, rel in files if rel.startswith('inspection/proofs/')]
    if args.proof_output:
        files = [(p, rel) for p, rel in files if not rel.startswith('inspection/proofs/')]
    inventory = [{'file': rel, 'bytes': p.stat().st_size,
                  'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p, rel in files]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    prefix = 'Just_Aliens_Production_v2'
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for index, (path, relative) in enumerate(files):
            archive.write(path, f'{prefix}/{relative}')
            if index % 200 == 0:
                print(f'Packaged {index}/{len(files)}', flush=True)
        archive.writestr(f'{prefix}/PACKAGE_SHA256.json', json.dumps(inventory, indent=2) + '\n')
    with zipfile.ZipFile(args.output) as archive:
        assert archive.testzip() is None
    if args.proof_output:
        args.proof_output.parent.mkdir(parents=True, exist_ok=True)
        proof_index = [{'file': rel, 'bytes': p.stat().st_size,
                        'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p, rel in proof_files]
        with zipfile.ZipFile(args.proof_output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path, relative in proof_files:
                archive.write(path, f'{prefix}/{relative}')
            archive.writestr(f'{prefix}/PROOFS_SHA256.json', json.dumps(proof_index, indent=2) + '\n')
        with zipfile.ZipFile(args.proof_output) as archive:
            assert archive.testzip() is None
        print(json.dumps({'proof_file': str(args.proof_output), 'bytes': args.proof_output.stat().st_size,
                          'sha256': hashlib.sha256(args.proof_output.read_bytes()).hexdigest(),
                          'files': len(proof_files) + 1, 'zip_crc': 'passed'}), flush=True)
    print(json.dumps({'file': str(args.output), 'bytes': args.output.stat().st_size,
                      'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
                      'files': len(files) + 1, 'zip_crc': 'passed'}), flush=True)


if __name__ == '__main__':
    main()
