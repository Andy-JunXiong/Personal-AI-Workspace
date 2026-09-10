"""Source-preserving export for the reviewed nine-region Word template.

Only document.xml and (when edited project links need it) its relationships change.
All other ZIP parts are copied byte-for-byte. No personal data lives in this file.
"""
import copy
import json
import re
import sys
import zipfile
from xml.dom import minidom as D

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P = 'http://schemas.openxmlformats.org/package/2006/relationships'
SECTIONS = dict(name=0, headline=1, contact=2, summary=5, skills=8,
                projects=16, experience=32, certifications=51, education=57)


def elements(node, tag):
    return list(node.getElementsByTagName(tag))


def text(node):
    return ''.join(x.firstChild.data if x.firstChild else '' for x in elements(node, 'w:t'))


def line(node):
    return re.sub(r'\s+', ' ', text(node)).strip()


def split_columns(node):
    value = ''.join(('\t' if x.tagName == 'w:tab' else text(x)) for x in node.childNodes if x.nodeType == x.ELEMENT_NODE and x.tagName in ('w:r', 'w:hyperlink'))
    # Real tabs are nested in runs; retain them for old position headers.
    value = ''.join(('\t' if x.tagName == 'w:tab' else (x.firstChild.data if x.firstChild else '')) for x in node.getElementsByTagName('*') if x.tagName in ('w:t', 'w:tab'))
    parts = re.split(r'\t+| {3,}', value.strip(), maxsplit=1)
    return [p.strip() for p in parts] if len(parts) == 2 else [value.strip(), '']


class Template:
    def __init__(self, path):
        self.path = path
        with zipfile.ZipFile(path) as archive:
            if sum(i.file_size for i in archive.infolist()) > 12_000_000:
                raise ValueError('Template is too large')
            self.parts = {i.filename: archive.read(i) for i in archive.infolist()}
        for part in ('word/document.xml', 'word/_rels/document.xml.rels'):
            if b'<!DOCTYPE' in self.parts[part] or b'<!ENTITY' in self.parts[part]:
                raise ValueError('Unsupported XML declaration')
        self.doc = D.parseString(self.parts['word/document.xml'])
        self.rels = D.parseString(self.parts['word/_rels/document.xml.rels'])
        self.body = elements(self.doc, 'w:body')[0]
        self.ps = [n for n in self.body.childNodes if n.nodeType == n.ELEMENT_NODE]
        # Deliberately reject unfamiliar templates, instead of silently mapping wrong content.
        if len(self.ps) != 67 or any(line(self.ps[i]) != title for i, title in [(5, 'Professional Summary'), (8, 'Core Skills'), (32, 'Professional Experience'), (51, 'Certifications'), (57, 'Education')]):
            raise ValueError('This file does not match the reviewed nine-region template')
        if elements(self.doc, 'w:sdt') or elements(self.doc, 'w:fldChar') or elements(self.doc, 'w:ins') or elements(self.doc, 'w:del'):
            raise ValueError('Unsupported field, control or tracked edit in template')
        self.links = {r.getAttribute('Id'): r.getAttribute('Target') for r in self.rels.documentElement.childNodes if r.nodeType == r.ELEMENT_NODE}
        self.links_changed = False

    def initial(self):
        p = self.ps
        projects = []
        for title, start, end in [(18, 19, 22), (23, 24, 27), (28, 29, 31)]:
            links = elements(p[title], 'w:hyperlink')
            projects.append(dict(name=line(p[title]).split(' | ')[0], github=self.links[links[0].getAttribute('r:id')], demo=self.links[links[1].getAttribute('r:id')], demoLabel=text(links[1]), bullets=[line(p[i]) for i in range(start, end)]))
        experience = []
        for title, dates, summary, start, end in [(34, 35, 36, 37, 40), (40, 41, None, 42, 45), (46, 47, None, 48, 50)]:
            name, location = split_columns(p[title])
            experience.append(dict(title=name, location=location, dates=line(p[dates]), summary=line(p[summary]) if summary else '', bullets=[line(p[i]) for i in range(start, end)]))
        education = []
        for i in (59, 63):
            school, location = split_columns(p[i]); degree, dates = split_columns(p[i+1])
            education.append(dict(school=school, location=location, degree=degree, dates=dates, detail=line(p[i+2])))
        skills = []
        for i in range(10, 15):
            name, content = line(p[i]).split(': ', 1)
            skills.append(dict(name=name, content=content))
        skills.append(dict(name='', content=''))
        return dict(name=line(p[0]), headline=line(p[1]), contact=line(p[2]), summaryHeading=line(p[5]), summary=line(p[6]), skillsHeading=line(p[8]), skills=skills, projectsHeading=line(p[16]), projects=projects, experienceHeading=line(p[32]), experience=experience, certificationsHeading=line(p[51]), certifications=[line(p[54]), line(p[55])], educationHeading=line(p[57]), education=education)

    def run(self, value, source, bold=None):
        r = self.doc.createElementNS(W, 'w:r')
        runs = [n for n in source.childNodes if getattr(n, 'tagName', None) == 'w:r' and text(n).strip()]
        properties = elements(runs[0], 'w:rPr') if runs else elements(source, 'w:rPr')
        pr = properties[0].cloneNode(True) if properties else self.doc.createElementNS(W, 'w:rPr')
        if bold is not None:
            for tag in ('w:b', 'w:bCs'):
                for child in list(pr.childNodes):
                    if getattr(child, 'tagName', None) == tag: pr.removeChild(child)
                b = self.doc.createElementNS(W, tag); b.setAttribute('w:val', '1' if bold else '0'); pr.appendChild(b)
        r.appendChild(pr)
        for i, row in enumerate(value.split('\n')):
            if i: r.appendChild(self.doc.createElementNS(W, 'w:br'))
            t = self.doc.createElementNS(W, 'w:t'); t.setAttribute('xml:space', 'preserve'); t.appendChild(self.doc.createTextNode(row)); r.appendChild(t)
        return r

    def paragraph(self, index, value, bold=None):
        source = self.ps[index]
        p = self.doc.createElementNS(W, 'w:p')
        for c in source.childNodes:
            if getattr(c, 'tagName', None) == 'w:pPr': p.appendChild(c.cloneNode(True))
        p.appendChild(self.run(value, source, bold))
        return p

    def replace(self, start, end, nodes):
        for node in nodes: self.body.insertBefore(node, self.ps[start])
        for node in self.ps[start:end]: self.body.removeChild(node)

    def link(self, p, label, target):
        if not target: return
        if not re.match(r'^https?://', target): raise ValueError('Unsafe project URL')
        p.appendChild(self.run(' | ', self.ps[18], True))
        rid = 'resumeLink' + str(len(self.links) + 1)
        self.links[rid] = target
        r = self.rels.createElementNS(P, 'Relationship')
        for key, value in dict(Id=rid, Type=R+'/hyperlink', Target=target, TargetMode='External').items(): r.setAttribute(key, value)
        self.rels.documentElement.appendChild(r); self.links_changed = True
        h = self.doc.createElementNS(W, 'w:hyperlink'); h.setAttribute('r:id', rid)
        h.appendChild(self.run(label, elements(self.ps[18], 'w:hyperlink')[0], True)); p.appendChild(h)

    def columns(self, index, left, right):
        p = self.paragraph(index, left)
        pr = elements(p, 'w:pPr')[0]
        for c in list(pr.childNodes):
            if getattr(c, 'tagName', None) in ('w:tabs', 'w:jc'): pr.removeChild(c)
        tabs = self.doc.createElementNS(W, 'w:tabs'); tab = self.doc.createElementNS(W, 'w:tab')
        tab.setAttribute('w:val', 'right'); tab.setAttribute('w:pos', '10467'); tabs.appendChild(tab); pr.appendChild(tabs)
        r = self.run('', self.ps[index]); r.appendChild(self.doc.createElementNS(W, 'w:tab')); p.appendChild(r)
        p.appendChild(self.run(right, self.ps[index], True)); return p

    def keep_next(self, p):
        pr = elements(p, 'w:pPr')[0]
        for child in list(pr.childNodes):
            if getattr(child, 'tagName', None) == 'w:keepNext': pr.removeChild(child)
        pr.appendChild(self.doc.createElementNS(W, 'w:keepNext'))
        return p

    def body_leading_gap(self, paragraph, twips):
        pr = elements(paragraph, 'w:pPr')[0]
        spacing_nodes = elements(pr, 'w:spacing')
        if spacing_nodes:
            spacing = spacing_nodes[0]
        else:
            spacing = self.doc.createElementNS(W, 'w:spacing')
            anchor = next((n for n in pr.childNodes if getattr(n, 'tagName', None) in
                           ('w:ind', 'w:contextualSpacing', 'w:jc', 'w:rPr')), None)
            pr.insertBefore(spacing, anchor)
        changed = False
        for key, value in [('before', str(twips)), ('beforeAutospacing', '0')]:
            if spacing.getAttribute('w:'+key) != value:
                spacing.setAttribute('w:'+key, value); changed = True
        return changed

    def normalize_body_spacing(self):
        # Match the user's Nuix reference: roomy project headings, the original
        # project-body leading, and 14pt between entries. Explicit values avoid
        # Word/LibreOffice differences in imported HTML automatic margins.
        bullets = (*range(19, 22), *range(24, 27), 29, 30,
                   *range(37, 40), *range(42, 45), 48, 49)
        text_slots = (18, 23, 28, 34, 35, 36, 40, 41, 46, 47, *bullets)
        for index in text_slots:
            self.body_leading_gap(self.ps[index], 60 if index == 37 else 0)
            pr = elements(self.ps[index], 'w:pPr')[0]
            spacing = elements(pr, 'w:spacing')[0]
            leading = '276' if index in (18, 23, 28, 24, 25, 26) else '244' if index in (29, 30) else '240'
            for key, value in [('after', '0'), ('afterAutospacing', '0'),
                               ('line', leading), ('lineRule', 'auto')]:
                spacing.setAttribute('w:'+key, value)
            if index in bullets or index == 36:
                for node in elements(pr, 'w:jc'): pr.removeChild(node)
                alignment = self.doc.createElementNS(W, 'w:jc')
                alignment.setAttribute('w:val', 'left'); pr.appendChild(alignment)
                for node in elements(pr, 'w:keepLines'): pr.removeChild(node)
                pr.appendChild(self.doc.createElementNS(W, 'w:keepLines'))
        # One reference-sized separator; never stacked empty paragraphs.
        for index in (17, 22, 27, 31, 33, 45, 50):
            self.body_leading_gap(self.ps[index], 0)
            spacing = elements(elements(self.ps[index], 'w:pPr')[0], 'w:spacing')[0]
            for key, value in [('after', '0'), ('afterAutospacing', '0'),
                               ('line', '280'), ('lineRule', 'exact')]:
                spacing.setAttribute('w:'+key, value)
        # The original first/second jobs have no separator paragraph.
        self.body_leading_gap(self.ps[40], 280)
        return True

    def normalize_pdf_list_spacing(self):
        # Word collapses imported HTML automatic margins between list items;
        # LibreOffice does not. Materialize that collapse only for the PDF input.
        paragraphs = elements(self.body, 'w:p')
        def list_id(p):
            ids = p.getElementsByTagName('w:numId')
            return ids[0].getAttribute('w:val') if ids else None
        for i, p in enumerate(paragraphs):
            pr = elements(p, 'w:pPr')
            styles = elements(pr[0], 'w:pStyle') if pr else []
            if not styles or styles[0].getAttribute('w:val') != 'pdq2pgselectionanchorcontainer':
                continue
            current_id = list_id(p)
            if current_id is None: continue
            spacing = elements(pr[0], 'w:spacing')
            if not spacing:
                node = self.doc.createElementNS(W, 'w:spacing'); pr[0].appendChild(node)
            else: node = spacing[0]
            for side, neighbor in [('before', i-1), ('after', i+1)]:
                if 0 <= neighbor < len(paragraphs) and list_id(paragraphs[neighbor]) == current_id:
                    node.setAttribute('w:'+side, '0')
                    node.setAttribute('w:'+side+'Autospacing', '0')

    def export(self, content, output, for_pdf=False):
        old = self.initial()
        if content['name'] != old['name'] or content['contact'] != old['contact']: raise ValueError('Fixed header changed')
        order = content.get('sectionOrder', list(SECTIONS))
        if not isinstance(order, list) or len(order) != len(SECTIONS) or any(not isinstance(k, str) for k in order) or set(order) != set(SECTIONS):
            raise ValueError('Each resume section must appear exactly once')
        # Mark boundaries before replacing editable paragraphs. Markers are
        # removed before serialization; the template and section/footer stay put.
        markers = {}
        if order != list(SECTIONS):
            for key, index in SECTIONS.items():
                marker = self.doc.createComment('resume-section-'+key)
                self.body.insertBefore(marker, self.ps[index]); markers[marker] = key
        spacing_corrected = self.normalize_body_spacing()
        for key, index in [('headline', 1), ('summaryHeading', 5), ('summary', 6), ('skillsHeading', 8), ('projectsHeading', 16), ('experienceHeading', 32), ('certificationsHeading', 51), ('educationHeading', 57)]:
            if content[key] != old[key]: self.replace(index, index+1, [self.paragraph(index, content[key])])
        if content['skills'] != old['skills']:
            nodes = []
            for skill in content['skills']:
                if not skill['name'] and not skill['content']: continue
                p = self.paragraph(10, skill['name']+(': ' if skill['name'] and skill['content'] else ''), True)
                p.appendChild(self.run(skill['content'], self.ps[10], False)); nodes.append(p)
            self.replace(10, 15, nodes)
        if content['projects'] != old['projects']:
            nodes = []
            for i, item in enumerate(content['projects']):
                heading = [18, 23, 28][min(i, 2)]
                bullet = [19, 24, 29][min(i, 2)]
                p = self.keep_next(self.paragraph(heading, item['name'], True))
                self.link(p, 'GitHub', item['github']); self.link(p, item['demoLabel'] or 'Demo', item['demo'])
                nodes.append(p); nodes.extend(self.paragraph(bullet, b, False) for b in item['bullets'] if b.strip())
                if i + 1 < len(content['projects']): nodes.append(self.ps[22].cloneNode(True))
            self.replace(18, 31, nodes)
        if content['experience'] != old['experience']:
            nodes = []
            for i, item in enumerate(content['experience']):
                nodes.append(self.keep_next(self.columns(34, item['title'], item['location'])))
                dates = self.paragraph(35, item['dates'], True)
                pr = elements(dates, 'w:pPr')[0]
                for c in list(pr.childNodes):
                    if getattr(c, 'tagName', None) == 'w:jc': pr.removeChild(c)
                jc = self.doc.createElementNS(W, 'w:jc'); jc.setAttribute('w:val', 'right'); pr.appendChild(jc); nodes.append(self.keep_next(dates))
                if item['summary']: nodes.append(self.paragraph(36, item['summary'], False))
                for j, bullet in enumerate(b for b in item['bullets'] if b.strip()):
                    paragraph = self.paragraph(37, bullet, False)
                    self.body_leading_gap(paragraph, 60 if j == 0 and item['summary'].strip() else 0)
                    nodes.append(paragraph)
                if i + 1 < len(content['experience']): nodes.append(self.ps[45].cloneNode(True))
            self.replace(34, 50, nodes)
        if content['certifications'] != old['certifications']:
            self.replace(54, 56, [self.paragraph(54, b, True) for b in content['certifications'] if b.strip()])
        # The original uses long runs of spaces for columns, which overflow
        # with Linux font substitution. PDF always uses explicit right tabs.
        if for_pdf or content['education'] != old['education']:
            nodes = []
            for item in content['education']:
                nodes.extend([self.columns(59, item['school'], item['location']), self.columns(60, item['degree'], item['dates']), self.paragraph(61, item['detail']), self.ps[62].cloneNode(True)])
            self.replace(59, 66, nodes)
        if for_pdf: self.normalize_pdf_list_spacing()
        if markers:
            groups = {key: [] for key in SECTIONS}; current = None
            for node in list(self.body.childNodes):
                if node in markers:
                    current = markers[node]; self.body.removeChild(node)
                elif getattr(node, 'tagName', None) == 'w:sectPr':
                    current = None
                elif current is not None:
                    groups[current].append(node); self.body.removeChild(node)
            section_properties = next((n for n in self.body.childNodes if getattr(n, 'tagName', None) == 'w:sectPr'), None)
            for key in order:
                for node in groups[key]: self.body.insertBefore(node, section_properties)
        if content == old and not spacing_corrected and not for_pdf:
            with open(self.path, 'rb') as src, open(output, 'wb') as dst: dst.write(src.read())
            return
        changes = {'word/document.xml': self.doc.toxml(encoding='UTF-8')}
        if self.links_changed: changes['word/_rels/document.xml.rels'] = self.rels.toxml(encoding='UTF-8')
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in self.parts.items(): archive.writestr(name, changes.get(name, data))


if __name__ == '__main__':
    template = Template(sys.argv[2])
    if sys.argv[1] == 'inspect':
        sys.stdout.buffer.write(json.dumps(template.initial(), ensure_ascii=False).encode('utf-8'))
    elif sys.argv[1] in ('export', 'export-pdf'):
        with open(sys.argv[3], encoding='utf-8') as src: content = json.load(src)
        template.export(content, sys.argv[4], for_pdf=sys.argv[1] == 'export-pdf')
    else: raise ValueError('Expected inspect or export')
