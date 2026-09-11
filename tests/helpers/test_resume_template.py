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
    def test_education_does_not_add_a_footer_only_trailing_page(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            for pdf in (False,True):
                template=module.Template(source);content=template.initial()
                content['education'][-1]['detail']='Final education detail'
                output=root/'education.docx';template.export(content,output,for_pdf=pdf)
                with zipfile.ZipFile(output) as z:
                    doc=module.D.parseString(z.read('word/document.xml'))
                    ps=module.elements(doc,'w:p')
                    self.assertEqual(module.text(ps[-1]),'Final education detail')
                    first_detail=next(i for i,p in enumerate(ps) if module.text(p)=='Example Major')
                    self.assertEqual(module.text(ps[first_detail+1]),'')
                    self.assertEqual(module.text(ps[first_detail+2]),'Example UniversityExample City')

    def test_section_and_item_order_preserve_complete_blocks_and_template_parts(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            content=module.Template(source).initial()
            for group in ('skills','projects','experience','certifications','education'):
                content[group].reverse()
            for i,item in enumerate(content['projects']): item['name']=f'Project sentinel {i}';item['bullets']=[f'Project body {i}']
            for i,item in enumerate(content['experience']): item['title']=f'Job sentinel {i}';item['bullets']=[f'Job body {i}']
            markers={'name':content['name'],'headline':content['headline'],'contact':content['contact'],
                     **{key:content[key+'Heading'] for key in ('summary','skills','projects','experience','certifications','education')}}
            # Every section can occupy the first and last positions; include the
            # requested experience-before-projects example and a complete reverse.
            orders=[list(module.SECTIONS)[i:]+list(module.SECTIONS)[:i] for i in range(9)]
            orders.append(list(reversed(module.SECTIONS)))
            for for_pdf in (False,True):
                for order in orders:
                    with self.subTest(pdf=for_pdf,order=order):
                        output=root/'ordered.docx';content['sectionOrder']=order
                        module.Template(source).export(content,output,for_pdf=for_pdf)
                        with zipfile.ZipFile(source) as before,zipfile.ZipFile(output) as after:
                            xml=after.read('word/document.xml');doc=module.D.parseString(xml)
                            paragraphs=[module.text(p) for p in module.elements(doc,'w:p')]
                            positions=[paragraphs.index(markers[key]) for key in order]
                            self.assertEqual(positions,sorted(positions))
                            for group,label,body in [('projects','Project sentinel','Project body'),('experience','Job sentinel','Job body')]:
                                start=paragraphs.index(markers[group]);end=next((p for p in positions if p>start),len(paragraphs))
                                region='\n'.join(paragraphs[start:end])
                                for i in range(len(content[group])):
                                    self.assertIn(f'{label} {i}',region);self.assertIn(f'{body} {i}',region)
                                    if i: self.assertLess(region.index(f'{body} {i-1}'),region.index(f'{label} {i}'))
                            for group in ('skills','certifications','education'):
                                values=[(x['name'] if group=='skills' else x['school']) if isinstance(x,dict) else x for x in content[group]]
                                values=[v for v in values if v]
                                region='\n'.join(paragraphs)
                                self.assertEqual([region.index(v) for v in values],sorted(region.index(v) for v in values))
                            self.assertNotIn(b'resume-section-',xml)
                            self.assertEqual(module.elements(doc,'w:body')[0].lastChild.tagName,'w:sectPr')
                            for name in before.namelist():
                                if name not in ('word/document.xml','word/_rels/document.xml.rels'):self.assertEqual(before.read(name),after.read(name))

    def test_invalid_section_orders_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            for order in ([],['name']*9,list(module.SECTIONS)[:-1],list(module.SECTIONS)+['name'],None):
                content=module.Template(source).initial();content['sectionOrder']=order
                with self.assertRaises(ValueError):module.Template(source).export(content,root/'bad.docx')

    def test_pdf_education_dates_use_right_tabs_without_changing_word(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            template=module.Template(source);content=template.initial()
            template.export(content,root/'word.docx')
            self.assertEqual(module.text(module.D.parseString(template.parts['word/document.xml'])), module.text(module.D.parseString(zipfile.ZipFile(root/'word.docx').read('word/document.xml'))))
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

    def test_uniform_project_and_job_rhythm_for_both_exporters(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';synthetic_template(source)
            for count in (None,3,4,5):
                for pdf in (False,True):
                    template=module.Template(source);content=template.initial()
                    if count is not None:
                        content['projects']=[dict(content['projects'][i % 3], name=f'Project {i}') for i in range(count)]
                        content['experience'][0]['title']='Updated position'
                    # Simulate inherited HTML margins and expanded justified lines.
                    for index in (19,24,29,37):
                        pr=module.elements(template.ps[index],'w:pPr')[0]
                        spacing=module.elements(pr,'w:spacing')[0]
                        for key,value in [('before','100'),('after','100'),('beforeAutospacing','1'),('afterAutospacing','1'),('line','276')]:
                            spacing.setAttribute('w:'+key,value)
                        jc=template.doc.createElementNS(module.W,'w:jc');jc.setAttribute('w:val','both');pr.appendChild(jc)
                    output=root/f'fixed-{count}-{pdf}.docx';template.export(content,output,for_pdf=pdf)
                    with zipfile.ZipFile(output) as z:
                        ps=module.elements(module.D.parseString(z.read('word/document.xml')),'w:p')
                        start=next(i for i,p in enumerate(ps) if module.text(p).startswith(content['projects'][0]['name']))
                        end=next(i for i,p in enumerate(ps) if module.text(p)=='Certifications')
                        section=ps[start:end]
                        previous_blank=False
                        for p in section:
                            blank=not module.text(p).strip()
                            self.assertFalse(blank and previous_blank, 'Double blank separator')
                            previous_blank=blank
                            if blank:
                                spacing=module.elements(p,'w:spacing')[0]
                                self.assertEqual(spacing.getAttribute('w:line'),'280')
                                self.assertEqual(spacing.getAttribute('w:lineRule'),'exact')
                            if module.text(p)=='Example bullet':
                                spacing=module.elements(p,'w:spacing')[0]
                                self.assertIn(spacing.getAttribute('w:line'),('240','244','276'))
                                self.assertEqual(spacing.getAttribute('w:after'),'0')
                                self.assertEqual(spacing.getAttribute('w:afterAutospacing'),'0')
                                self.assertEqual(module.elements(p,'w:jc')[0].getAttribute('w:val'),'left')
                        self.assertEqual(sum(any(module.text(p).startswith(project['name']) for project in content['projects']) for p in section),len(content['projects']))
                        self.assertEqual(sum(module.text(p)=='Example bullet' for p in section),sum(len(p['bullets']) for p in content['projects'])+sum(len(p['bullets']) for p in content['experience'])+1)

    def test_roundtrip_and_structural_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source.docx';output=root/'output.docx';synthetic_template(source)
            template=module.Template(source);content=template.initial()
            self.assertEqual(len(content['skills']),6);self.assertEqual(content['skills'][5],{'name':'','content':''})
            self.assertEqual(content['experience'][0]['location'],'Example City')
            template.export(content,output)
            with zipfile.ZipFile(output) as z:
                self.assertEqual(module.text(module.D.parseString(z.read('word/document.xml'))),module.text(module.D.parseString(template.parts['word/document.xml'])))
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
