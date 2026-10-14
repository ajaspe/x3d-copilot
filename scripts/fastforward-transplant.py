"""Move the pptxgenjs-built slide into the official Web3D 2026 template package.

usage: python -I fastforward-transplant.py <template_unpacked_dir> <raw.pptx> <out.pptx> <clean.py>

The template keeps its master (blue gradient, Web3D logo), theme and embedded fonts; every
template slide is dropped and replaced by our single slide, its notes and its media.
"""
import os, re, shutil, subprocess, sys, zipfile

tpl, raw_pptx, out, clean_py = sys.argv[1:5]
work = os.path.join(os.path.dirname(out), "_ff_work")
rawdir = os.path.join(os.path.dirname(out), "_ff_raw")
for d in (work, rawdir):
    if os.path.isdir(d):
        shutil.rmtree(d)
shutil.copytree(tpl, work)
zipfile.ZipFile(raw_pptx).extractall(rawdir)


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


# 1. slide content
shutil.copy(os.path.join(rawdir, "ppt/slides/slide1.xml"), os.path.join(work, "ppt/slides/slide1.xml"))

# 2. slide rels: media files renamed with an ff- prefix so they never clash with template media
rels = read(os.path.join(rawdir, "ppt/slides/_rels/slide1.xml.rels"))
def move_media(m):
    name = m.group(1)
    shutil.copy(os.path.join(rawdir, "ppt/media", name), os.path.join(work, "ppt/media", "ff-" + name))
    return 'Target="../media/ff-' + name + '"'
rels = re.sub(r'Target="\.\./media/([^"]+)"', move_media, rels)
write(os.path.join(work, "ppt/slides/_rels/slide1.xml.rels"), rels)

# 3. notes
shutil.copy(os.path.join(rawdir, "ppt/notesSlides/notesSlide1.xml"), os.path.join(work, "ppt/notesSlides/notesSlide1.xml"))
shutil.copy(os.path.join(rawdir, "ppt/notesSlides/_rels/notesSlide1.xml.rels"), os.path.join(work, "ppt/notesSlides/_rels/notesSlide1.xml.rels"))

# 4. keep only slide 1 in the presentation
pres = os.path.join(work, "ppt/presentation.xml")
x = read(pres)
x = re.sub(r"<p:sldIdLst>.*?</p:sldIdLst>", '<p:sldIdLst><p:sldId id="256" r:id="rId6"/></p:sldIdLst>', x, flags=re.S)
write(pres, x)

# 5. content types: carry over any Default the raw package declares (mp4 etc.)
ct_path = os.path.join(work, "[Content_Types].xml")
ct = read(ct_path)
for ext, ctype in re.findall(r'<Default Extension="([^"]+)" ContentType="([^"]+)"/>', read(os.path.join(rawdir, "[Content_Types].xml"))):
    if f'Extension="{ext}"' not in ct:
        ct = ct.replace("<Types ", "<Types ", 1).replace("</Types>", f'<Default Extension="{ext}" ContentType="{ctype}"/></Types>')
write(ct_path, ct)

# 6. drop orphaned template slides, notes and media
env = dict(os.environ, PYTHONPATH=os.path.dirname(clean_py))
subprocess.run([sys.executable, clean_py, work], check=True, env=env)

# 7. zip, [Content_Types].xml first
if os.path.exists(out):
    os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(ct_path, "[Content_Types].xml")
    for root, _, files in os.walk(work):
        for fn in files:
            full = os.path.join(root, fn)
            arc = os.path.relpath(full, work).replace(os.sep, "/")
            if arc != "[Content_Types].xml":
                z.write(full, arc)
shutil.rmtree(work)
shutil.rmtree(rawdir)
print("wrote", out)
