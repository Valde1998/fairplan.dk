"""Start projektet med Docker: python run.py."""
import subprocess
from pathlib import Path

if __name__ == '__main__':
    subprocess.run(['docker', 'compose', 'up', '-d', '--build'], cwd=Path(__file__).parent, check=True)
    print('FairPlan: http://127.0.0.1:3001')
    print('phpMyAdmin: http://127.0.0.1:8081 (root / password)')
