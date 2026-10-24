#!/usr/bin/env python3
"""Build both editions without duplicating shared assets or publishing anything."""
import argparse, pathlib, shutil, subprocess, sys, tempfile
import yaml
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'site'));args=parser.parse_args()
 target=pathlib.Path(args.output).resolve()
 # Never clean a source directory or another arbitrary existing directory.
 if target==ROOT or ROOT in target.parents and target.parts[len(ROOT.parts):][:1] in [('docs',),('src',)]:
  raise SystemExit('Choose a dedicated site output directory')
 if target.exists() and any(target.iterdir()) and not (target/'.osh-docs-build').exists():
  raise SystemExit('Refusing to overwrite an unmarked output directory')
 with tempfile.TemporaryDirectory(prefix='osh-docs-build-') as temp:
  temp=pathlib.Path(temp)
  for lang,config_name,dest in [('en','tools/docs/mkdocs.yml',target),('pt-BR','tools/docs/mkdocs.pt-BR.yml',target/'pt-BR')]:
   source=temp/lang;source.mkdir()
   if lang=='en':
    shutil.copytree(ROOT/'docs',source,dirs_exist_ok=True,ignore=shutil.ignore_patterns('pt-BR','overrides'))
   else:
    for shared in ['assets','stylesheets','licenses','examples']:
     shutil.copytree(ROOT/'docs'/shared,source/shared,dirs_exist_ok=True)
    shutil.copytree(ROOT/'docs/pt-BR',source,dirs_exist_ok=True)
   config=yaml.safe_load((ROOT/config_name).read_text())
   config['docs_dir']=str(source);config['site_dir']=str(dest)
   config['theme']['custom_dir']=str(ROOT/'docs/overrides')
   config.pop('exclude_docs',None)
   config_file=temp/(lang+'.yml');config_file.write_text(yaml.safe_dump(config,allow_unicode=True,sort_keys=False))
   subprocess.run([sys.executable,'-m','mkdocs','build','--strict','--config-file',str(config_file)],check=True,cwd=ROOT)
  (target/'.osh-docs-build').write_text('Generated documentation; safe to rebuild.\n')
 print(f'English and Português (Brasil) built: {target}')
if __name__=='__main__':main()
