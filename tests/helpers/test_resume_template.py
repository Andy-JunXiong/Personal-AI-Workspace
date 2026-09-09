import importlib.util
import sys
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('resume_template', Path(__file__).resolve().parents[2] / 'scripts' / 'resume-template.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


def synthetic_template(path):
    contents = {0:'Example Person',1:'Engineer',2:'Example City | person@example.test',5:'Professional Summary',6:'Example summary',8:'Core Skills',16:'Independent Engineering',32:'Professional Experience',51:'Certifications',54:'Example certificate',55:'Second certificate',57:'Education'}
    for i in range(10,15): contents[i]=f'Skill {i}: Example skill'
    for i in (34,40,46): contents[i]='Example Position   Example City'; contents[i+1]='2020 - 2024'
    for i in (59,63): contents[i]='Example University   Example City'; contents[i+1]='Example Degree   2016 - 2020'; contents[i+2]='Example Major'
    for i in (19,20,21,24,25,26,29,30,36,37,38,39,42,43,44,48,49): contents[i]='Example bullet'
    ps=[]
    for i in range(66):
        value=contents.get(i,'')
        if i in (18,23,28):
            value=f'Example Project {i}'
            extra='<w:hyperlink r:id="link1"><w:r><w:rPr><w:color w:val="0000FF"/><w:u w:val="single"/></w:rPr><w:t>GitHub</w:t></w:r></w:hyperlink><w:hyperlink r:id="link2"><w:r><w:t>Demo</w:t></w:r></w:hyperlink>'
            value+=' | '
        else: extra=''
        ps.append(f'<w:p><w:pPr><w:spacing w:line="240"/><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:b/></w:rPr><w:t>{value}</w:t></w:r>{extra}</w:p>')
    doc=f'<w:document xmlns:w="{module.W}" xmlns:r="{module.R}"><w:body>'+''.join(ps)+'<w:sectPr><w:pgSz w:w="11907" w:h="16840"/></w:sectPr></w:body></w:document>'
    rels=f'<Relationships xmlns="{module.P}"><Relationship Id="link1" Target="https://github.com/example/project"/><Relationship Id="link2" Target="https://example.test/demo"/></Relationships>'
    with zipfile.ZipFile(path,'w') as z:
        z.writestr('word/document.xml',doc);z.writestr('word/_rels/document.xml.rels',rels)
        for name in ('styles','numbering','footer1','header1'): z.writestr(f'word/{name}.xml',f'<retained name="{name}"/>')


class ExportTests(unittest.TestCase):
    def test_pdf_education_dates_use_right_tabs_without_changing_word(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            template=module.Template(source);content=template.initial()
            template.export(content,root/'word.docx')
            self.assertEqual(source.read_bytes(),(root/'word.docx').read_bytes())
            module.Template(source).export(content,root/'pdf.docx',for_pdf=True)
            with zipfile.ZipFile(root/'pdf.docx') as z:
                ps=module.elements(module.D.parseString(z.read('word/document.xml')),'w:p')
                dates=[p for p in ps if '2016 - 2020' in module.text(p)]
                self.assertEqual(len(dates),2)
                for p in dates:
                    self.assertEqual(module.split_columns(p),['Example Degree','2016 - 2020'])
                    tab=module.elements(module.elements(p,'w:tabs')[0],'w:tab')[0]
                    self.assertEqual(tab.getAttribute('w:val'),'right')
                    self.assertEqual(tab.getAttribute('w:pos'),'10467')
                    self.assertEqual(module.elements(p,'w:jc'),[])
                    last=module.elements(p,'w:r')[-1]
                    self.assertEqual(module.elements(last,'w:b')[0].getAttribute('w:val'),'1')

    def test_pdf_collapses_only_contiguous_list_margins(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            template=module.Template(source)
            for i,p in enumerate(template.ps[:-1]):
                pr=module.elements(p,'w:pPr')[0]
                if i not in (37,38,39):
                    for n in module.elements(pr,'w:numPr'): pr.removeChild(n)
                else:
                    style=template.doc.createElementNS(module.W,'w:pStyle')
                    style.setAttribute('w:val','pdq2pgselectionanchorcontainer');pr.appendChild(style)
                    spacing=module.elements(pr,'w:spacing')[0]
                    for side in ('before','after'):
                        spacing.setAttribute('w:'+side,'100');spacing.setAttribute('w:'+side+'Autospacing','1')
            content=template.initial();template.export(content,root/'pdf-input.docx',for_pdf=True)
            with zipfile.ZipFile(root/'pdf-input.docx') as z:
                ps=module.elements(module.D.parseString(z.read('word/document.xml')),'w:p')
                for i,before,after in [(37,'60','0'),(38,'0','0'),(39,'0','100')]:
                    spacing=module.elements(ps[i],'w:spacing')[0]
                    self.assertEqual(spacing.getAttribute('w:before'),before)
                    self.assertEqual(spacing.getAttribute('w:after'),after)
                    self.assertEqual(spacing.getAttribute('w:line'),'240')

    def test_automatic_spacing_is_fixed_for_default_and_edited_exports(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            with zipfile.ZipFile(source) as z: parts={n:z.read(n) for n in z.namelist()}
            doc=module.D.parseString(parts['word/document.xml'])
            ps=module.elements(doc,'w:p')
            for i in (19,37,48):
                pr=module.elements(ps[i],'w:pPr')[0]
                style=doc.createElementNS(module.W,'w:pStyle');style.setAttribute('w:val','pdq2pgselectionanchorcontainer');pr.insertBefore(style,pr.firstChild)
                spacing=module.elements(pr,'w:spacing')[0]
                spacing.setAttribute('w:before','100');spacing.setAttribute('w:beforeAutospacing','1')
                spacing.setAttribute('w:after','100');spacing.setAttribute('w:afterAutospacing','1')
            parts['word/document.xml']=doc.toxml(encoding='UTF-8')
            with zipfile.ZipFile(source,'w') as z:
                for n,data in parts.items(): z.writestr(n,data)
            for edited in (False,True):
                template=module.Template(source);content=template.initial();output=root/f'fixed-{edited}.docx'
                if edited:
                    content['projects'][0]['name']='Changed project'
                    content['experience'][0]['title']='Changed position'
                template.export(content,output)
                with zipfile.ZipFile(output) as z:
                    for name,data in parts.items():
                        if name not in ('word/document.xml','word/_rels/document.xml.rels'): self.assertEqual(z.read(name),data)
                    final=module.D.parseString(z.read('word/document.xml'))
                    overview_gaps=0
                    for p in module.elements(final,'w:p'):
                        style=module.elements(p,'w:pStyle')
                        if style and style[0].getAttribute('w:val')=='pdq2pgselectionanchorcontainer':
                            spacing=module.elements(p,'w:spacing')[0]
                            self.assertIn(spacing.getAttribute('w:before'),('0','60'))
                            overview_gaps+=spacing.getAttribute('w:before')=='60'
                            self.assertEqual(spacing.getAttribute('w:beforeAutospacing'),'0')
                            self.assertEqual(spacing.getAttribute('w:after'),'100')
                            self.assertEqual(spacing.getAttribute('w:afterAutospacing'),'1')
                            self.assertEqual(spacing.getAttribute('w:line'),'240')
                    self.assertEqual(overview_gaps,1)
                    if not edited: self.assertEqual(module.text(final),module.text(doc))

    def test_roundtrip_and_structural_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';output=root/'output.docx';synthetic_template(source)
            template=module.Template(source);content=template.initial()
            self.assertEqual(len(content['skills']),6);self.assertEqual(content['skills'][5],{'name':'','content':''})
            self.assertEqual(content['experience'][0]['location'],'Example City')
            template.export(content,output);self.assertEqual(source.read_bytes(),output.read_bytes())
            content['headline']='Changed & <safe> \u4e2d\u6587'
            content['skills'][5]={'name':'Sixth','content':'Optional skill'}
            content['projects']+= [dict(content['projects'][0],name='Fourth',demo='https://example.test/four'),dict(content['projects'][0],name='Fifth')]
            content['experience'][0]['title']='New position'
            content['education'][0]['degree']='Changed degree'
            content['certifications'].append('Another certificate')
            module.Template(source).export(content,output)
            with zipfile.ZipFile(source) as before,zipfile.ZipFile(output) as after:
                self.assertEqual(before.namelist(),after.namelist())
                for name in before.namelist():
                    if name not in ('word/document.xml','word/_rels/document.xml.rels'): self.assertEqual(before.read(name),after.read(name))
                doc=module.D.parseString(after.read('word/document.xml'))
                rendered=module.text(doc)
                self.assertIn(content['headline'],rendered);self.assertIn('Fifth',rendered);self.assertIn('Sixth',rendered)
                body=module.elements(doc,'w:body')[0]
                self.assertEqual(module.text(body.childNodes[0]),'Example Person')
                self.assertEqual(module.text(body.childNodes[2]),'Example City | person@example.test')
                title=next(p for p in module.elements(doc,'w:p') if module.text(p).startswith('Fourth'))
                first=module.elements(title,'w:r')[0]
                self.assertFalse(module.elements(first,'w:color'))
                self.assertTrue(module.elements(title,'w:keepNext'))
                self.assertIn(b'https://example.test/four',after.read('word/_rels/document.xml.rels'))

    def test_fixed_identity_and_unfamiliar_template_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            template=module.Template(source);content=template.initial();content['name']='Different'
            with self.assertRaises(ValueError): template.export(content,root/'bad.docx')
            with zipfile.ZipFile(source,'w') as z:
                z.writestr('word/document.xml','<!DOCTYPE x><w:document/>');z.writestr('word/_rels/document.xml.rels','<x/>')
            with self.assertRaises(ValueError): module.Template(source)


if __name__=='__main__': unittest.main()
