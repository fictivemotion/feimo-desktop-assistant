'use strict';
// Xiaomi's training format uses OTSL cells. Preserve merges as HTML rather
// than silently flattening a rowspan/colspan into a misleading Markdown table.
function tableOutput(text){if(!/<(?:fcel|ecel)>/.test(text))return text;
 const source=text.replace(/<\/?otsl[^>]*>/g,'').replace(/^```[^\n]*\n|\n```\s*$/g,'');
 const tokens=source.match(/<(?:fcel|ecel|lcel|ucel|xcel|nl)>|[^<]+|<[^>]*>/g)||[],grid=[[]];let row=0,column=0,current=null,merged=false;
 for(const token of tokens){if(token==='<nl>'){row++;column=0;grid[row]=[];current=null;}else if(['<fcel>','<ecel>'].includes(token)){current={text:'',row,column,rows:1,cols:1};grid[row][column++]=current;}else if(['<lcel>','<ucel>','<xcel>'].includes(token)){const c=token==='<lcel>'?grid[row][column-1]:grid[row-1]?.[column];if(!c)throw Error('表格合并位置不完整，请缩小选区重试');grid[row][column]=c;c.rows=Math.max(c.rows,row-c.row+1);c.cols=Math.max(c.cols,column-c.column+1);column++;current=null;merged=true;}else if(current)current.text+=token;}
 const rows=grid.filter(r=>r.length),width=Math.max(...rows.map(r=>r.length));if(!rows.length||width>100||rows.length>1000)throw Error('表格结构无效');
 const escape=s=>s.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 if(merged)return '<table>\n'+rows.map((r,i)=>'<tr>'+r.map((c,j)=>c&&c.row===i&&c.column===j?`<td${c.rows>1?' rowspan="'+c.rows+'"':''}${c.cols>1?' colspan="'+c.cols+'"':''}>${escape(c.text)}</td>`:'').join('')+'</tr>').join('\n')+'\n</table>';
 const line=r=>'| '+Array.from({length:width},(_,i)=>(r[i]?.text||'').trim().replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>')).join(' | ')+' |';return [line(rows[0]),'| '+Array(width).fill('---').join(' | ')+' |',...rows.slice(1).map(line)].join('\n');
}
module.exports={tableOutput};
