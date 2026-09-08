"""Rebuild the pinned 2025 evidence offline from the reviewed handoff archive."""
from pathlib import Path
import argparse, json, subprocess, sys, tempfile, zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, help='Write a regenerated snapshot; otherwise verify the committed snapshot')
args = parser.parse_args()
with tempfile.TemporaryDirectory(prefix='dugout-performance-') as folder:
    folder = Path(folder)
    with zipfile.ZipFile(root / 'handoff/research-assets.zip') as archive:
        for item in archive.infolist():
            if item.filename.startswith('performance-sources/'):
                (folder / Path(item.filename).name).write_bytes(archive.read(item))
    output = folder / 'performance.json'
    for script in ['normalize.py', 'enrich.py']:
        subprocess.run([sys.executable, str(root / 'scripts/performance' / script), str(folder), str(output)], check=True, stdout=subprocess.DEVNULL)
    if args.output:
        args.output.write_bytes(output.read_bytes())
        print('Wrote', args.output)
    else:
        def canonical(path):
            data = json.loads(path.read_text())
            return sorted(json.dumps(row, sort_keys=True, ensure_ascii=False) for row in data['records'])
        if canonical(output) != canonical(root / 'apps/api/seed/performance-2025.json'):
            raise SystemExit('Rebuilt evidence differs from committed snapshot')
        print('Verified all 2025 evidence records from archived official source snapshots')
