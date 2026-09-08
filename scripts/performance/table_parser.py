from html.parser import HTMLParser
from pathlib import Path
import urllib.request,urllib.parse,http.cookiejar,json,re
class Parse(HTMLParser):
 def __init__(self,html):
  super().__init__();self.fields={};self.select='';self.opt=None;self.rows=[];self.row=None;self.cell=None;self.links=[];self.feed(html)
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='input' and a.get('name'):self.fields[a['name']]=a.get('value','')
  if t=='select':self.select=a.get('name','')
  if t=='option' and self.select and (self.select not in self.fields or 'selected' in a):self.fields[self.select]=a.get('value','')
  if t=='tr':self.row=[]
  if t in ['td','th'] and self.row is not None:self.cell=''
  if t=='a' and 'href' in a:self.links.append(a['href'])
 def handle_data(self,s):
  if self.cell is not None:self.cell+=s
 def handle_endtag(self,t):
  if t=='select':self.select=''
  if t in ['td','th'] and self.cell is not None:
   if self.row is not None:self.row.append(re.sub(r'\s+',' ',self.cell).strip())
   self.cell=None
  if t=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
