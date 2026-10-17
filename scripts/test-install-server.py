#!/usr/bin/env python3
"""Focused installer safety tests. Fake Docker, temporary files, no daemon mutations."""
import json, os, pathlib, shutil, subprocess, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
FAKE=r'''#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]
with open(os.environ['FAKE_CALLS'],'a') as f:f.write(json.dumps(args)+'\n')
if args[:1]==['info']:sys.exit(1 if os.environ.get('FAKE_DAEMON_DOWN') else 0)
if args[:2]==['compose','version']:sys.exit(0)
if args[:1]==['ps']:
 print('existing-container' if os.environ.get('FAKE_EXISTING') else '');sys.exit(0)
if args[:2]==['volume','ls']:sys.exit(0)
if args[:2]==['image','inspect']:sys.exit(0)
if args[:1]==['run']:
 if 'randomBytes' in ' '.join(args): print('A'*43+'=',end='');sys.exit(0)
 if os.environ.get('FAKE_PORT_BUSY'):print('Address unavailable',file=sys.stderr);sys.exit(1)
 sys.exit(0)
if args[:1]==['compose']:
 if 'run' in args and os.environ.get('FAKE_MIGRATE_FAIL'):print('private-service-detail',file=sys.stderr);sys.exit(1)
 if 'up' in args and os.environ.get('FAKE_START_FAIL'):sys.exit(1)
 if 'ps' in args:print('openstudyhub-app running (healthy)')
 if 'exec' in args:print('HTTP 200 / version 3.0.0')
 sys.exit(0)
sys.exit(2)
'''
class InstallerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='osh-install-tests-');self.base=pathlib.Path(self.tmp.name)
  self.bin=self.base/'bin';self.bin.mkdir();(self.bin/'docker').write_text(FAKE);(self.bin/'docker').chmod(0o755)
  self.target=self.base/'instance';self.calls=self.base/'calls'
  self.env={**os.environ,'PATH':str(self.bin)+':'+os.environ['PATH'],'FAKE_CALLS':str(self.calls)}
 def tearDown(self):self.tmp.cleanup()
 def run_install(self,*args):
  return subprocess.run(['/bin/bash',str(ROOT/'scripts/install-server.sh'),'--directory',str(self.target),'--image','openstudyhub:3.0.0','--yes',*args],env=self.env,text=True,capture_output=True,timeout=15)
 def test_clean_install_private_config_and_no_key_output(self):
  out=self.run_install();self.assertEqual(out.returncode,0,out.stderr)
  self.assertEqual((self.target/'.env').stat().st_mode&0o777,0o600)
  self.assertIn('GOOGLE_TOKEN_ENCRYPTION_KEY=',(self.target/'.env').read_text())
  self.assertNotIn('A'*43,out.stdout+out.stderr)
  self.assertIn('127.0.0.1:3001',out.stdout)
 def test_second_execution_preserves_every_file(self):
  self.assertEqual(self.run_install().returncode,0)
  before={p.name:p.read_bytes() for p in self.target.iterdir()}
  self.assertNotEqual(self.run_install().returncode,0)
  self.assertEqual(before,{p.name:p.read_bytes() for p in self.target.iterdir()})
 def test_existing_docker_project_refused_before_creating_directory(self):
  self.env['FAKE_EXISTING']='1';out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertFalse(self.target.exists())
 def test_occupied_port_refused_before_files(self):
  self.env['FAKE_PORT_BUSY']='1';out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertFalse(self.target.exists())
 def test_migration_failure_keeps_recovery_files_and_never_starts_services(self):
  self.env['FAKE_MIGRATE_FAIL']='1';out=self.run_install();self.assertNotEqual(out.returncode,0)
  self.assertTrue((self.target/'.env').exists());self.assertNotIn('private-service-detail',out.stdout+out.stderr)
  calls=[json.loads(x) for x in self.calls.read_text().splitlines()]
  self.assertFalse(any('up' in x for x in calls));self.assertFalse(any('down' in x for x in calls))
 def test_start_failure_preserves_config(self):
  self.env['FAKE_START_FAIL']='1';out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertTrue((self.target/'.env').exists())
 def test_invalid_values_do_not_write_files(self):
  for args in [('--app-port','3001'),('--app-port','abc'),('--app-url','https://user:secret@example.org'),('--image','openstudyhub:latest')]:
   out=self.run_install(*args);self.assertNotEqual(out.returncode,0);self.assertFalse(self.target.exists())
 def test_diagnose_does_not_mutate_configuration_or_start_services(self):
  self.assertEqual(self.run_install('--project','docs-qa').returncode,0)
  before={p.name:p.read_bytes() for p in self.target.iterdir()};self.calls.write_text('')
  out=self.run_install('--diagnose');self.assertEqual(out.returncode,0,out.stderr)
  self.assertEqual(before,{p.name:p.read_bytes() for p in self.target.iterdir()})
  calls=[json.loads(x) for x in self.calls.read_text().splitlines()]
  self.assertFalse(any('up' in x or 'run' in x or 'pull' in x or 'down' in x for x in calls))
  self.assertNotIn('A'*43,out.stdout+out.stderr)
 def test_unavailable_daemon_does_not_write_files(self):
  self.env['FAKE_DAEMON_DOWN']='1';out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertFalse(self.target.exists())
 def test_insufficient_disk_refused_before_pull_or_files(self):
  (self.bin/'df').write_text('#!/bin/sh\necho "Filesystem 1024-blocks Used Available Capacity Mounted"\necho "disk 1000 900 100 90% /"\n');(self.bin/'df').chmod(0o755)
  out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertFalse(self.target.exists())
  calls=[json.loads(x) for x in self.calls.read_text().splitlines()]
  self.assertFalse(any('pull' in x or 'run' in x for x in calls))
 def test_docker_absent(self):
  tools=self.base/'minimal';tools.mkdir()
  for name in ['dirname','uname']:(tools/name).symlink_to(shutil.which(name))
  self.env['PATH']=str(tools)
  out=self.run_install();self.assertNotEqual(out.returncode,0);self.assertIn('Docker is missing',out.stderr);self.assertFalse(self.target.exists())
if __name__=='__main__':unittest.main()
