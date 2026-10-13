'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),JSZip=require('jszip');
const {parseTables,editedTables,tsv,html,writeTable,workbook}=require('../lib/capture-export');
const {formula}=require('../renderer/shared/capture-result-format');
test('table output preserves merged cells, Unicode and quotes; clipboard includes Excel HTML plus tabular text',async()=>{
 const source='<table><tr><th colspan="2">季度统计</th></tr><tr><td rowspan="2">甲\n乙</td><td>12</td></tr><tr><td>0012</td></tr></table>',model=parseTables(source)[0];assert.deepEqual(model.merges,[{r:0,c:0,rs:1,cs:2},{r:1,c:0,rs:2,cs:1}]);assert.equal(tsv(model),'季度统计\t\r\n"甲\n乙"\t12\r\n\t0012');assert.match(html(model),/rowspan="2"/);
 let item;class Clip{constructor(data){this.data=data;}}const clipboard={write:async items=>item=items[0],readText:async()=>item.data['text/plain'].text()};await writeTable(clipboard,Clip,model);assert.deepEqual(Object.keys(item.data),['text/plain','text/html']);assert.match(await item.data['text/html'].text(),/季度统计/);
 const edited=editedTables({source,edits:[{index:0,text:tsv(model).replace('\t12\r','\t42\r')}]})[0];assert.equal(edited.rows[1][1],'42');assert.equal(edited.merges.length,2);assert.throws(()=>parseTables('<table><tr><td rowspan="1000">x</td></tr></table>'),/范围无效/);assert.throws(()=>editedTables({source,edits:[{index:9,text:'x'}]}),/无效/);
});
test('Markdown and TSV become real cells; Excel ZIP keeps numbers, text IDs, literal formulas and merge metadata',async()=>{
 const tables=parseTables('| 名称 | 数量 |\n| --- | --- |\n| A\\|B | 12 |\n| 0012 | =1+1 |');assert.deepEqual(tables[0].rows,[['名称','数量'],['A|B','12'],['0012','=1+1']]);const merged=parseTables('<table><tr><td colspan="2">标题</td></tr><tr><td>A</td><td>3</td></tr></table>');const zip=await JSZip.loadAsync(await workbook([...tables,...merged]));const first=await zip.file('xl/worksheets/sheet1.xml').async('string'),second=await zip.file('xl/worksheets/sheet2.xml').async('string');assert.match(first,/<c r="B2"><v>12<\/v>/);assert.match(first,/<c r="A3" t="inlineStr">/);assert.ok(first.includes('=1+1'));assert.ok(!first.includes('<f>'));assert.match(second,/<mergeCell ref="A1:B1"/);assert.ok(zip.file('[Content_Types].xml'));assert.equal(parseTables('A\tB\r\n1\t2')[0].rows.length,2);
});
test('formula format toggles are lossless and Markdown delimiters are not copied in LaTeX mode',()=>{
 const source='$$\n\\frac{a}{b}\n$$\n\n\\[x^2 + y^2\\]';const latex=formula(source,'latex');assert.equal(latex,'\\frac{a}{b}\n\nx^2 + y^2');assert.equal(formula(formula(latex,'markdown'),'latex'),latex);assert.equal(formula('```latex\nx=1\n```','latex'),'x=1');assert.equal(formula('$x+1$','markdown'),'$$\nx+1\n$$');
});
