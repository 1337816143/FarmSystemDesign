// The original author forms run unchanged. This module presents only this process's
// windows to a local browser; it never captures the user's desktop or injects global input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.Net;
using System.Net.Sockets;

namespace FarmSystemNative {
 public static class OriginalEntry {
  [STAThread] public static void Main(string[] args){
   try{
    string session=Path.GetFullPath(args[0]),bin=Path.Combine(session,"Bin");Directory.SetCurrentDirectory(bin);
    Console.InputEncoding=new UTF8Encoding(false);Console.OutputEncoding=new UTF8Encoding(false);
    Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
    var dal=Assembly.LoadFrom(Path.Combine(bin,"DAL.dll"));var exe=Assembly.LoadFrom(Path.Combine(bin,"FarmDESIGN.exe"));
    var flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Static|BindingFlags.Instance;
    var xml=new System.Xml.XmlDocument();xml.Load(Path.Combine(bin,"applConfig.FarmDESIGN.ini"));var type=dal.GetType("DAL.General.Init.ApplInit");
    var instance=Activator.CreateInstance(type,flags,null,new object[]{xml.DocumentElement.SelectNodes("element")},CultureInfo.InvariantCulture);
    type.GetField("_instance",flags).SetValue(null,instance);type.GetField("parentAppName",flags).SetValue(null,"FarmDESIGN");
    var ui=new NativeUi(null,session,args.Length<2||args[1]=="browser");ui.Run(()=> (Form)Activator.CreateInstance(exe.GetType("Design.GUI.InputForm")));
   }catch(Exception e){Console.WriteLine("@@FARMUI@@"+new JavaScriptSerializer().Serialize(new{ready=false,error=e.ToString()}));}
  }
 }
 public sealed class NativeUi {
  sealed class FreshConnection:IDisposable {
   public dynamic Value;
   public readonly string Database;
   public FreshConnection(string path){Database=Path.GetFileName(path);Value=Activator.CreateInstance(Type.GetTypeFromProgID("ADODB.Connection",true));Value.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source="+path+";Mode=Read;OLE DB Services=-2;","","",-1);Refresh();}
   public void Refresh(){dynamic engine=Activator.CreateInstance(Type.GetTypeFromProgID("JRO.JetEngine",true));try{engine.RefreshCache(Value);}finally{Marshal.FinalReleaseComObject(engine);}}
   public void Dispose(){if(Value!=null){Value.Close();Marshal.FinalReleaseComObject(Value);Value=null;}}
  }
  const BindingFlags Flags=BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic;
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=32*1024*1024,RecursionLimit=150};
  readonly ConcurrentQueue<Dictionary<string,object>> commands=new ConcurrentQueue<Dictionary<string,object>>();
  readonly Dictionary<string,Control> controls=new Dictionary<string,Control>();
  readonly Dictionary<string,ToolStripItem> items=new Dictionary<string,ToolStripItem>();
  readonly Dictionary<string,TreeNode> nodes=new Dictionary<string,TreeNode>();
  readonly HashSet<IntPtr> nativeControls=new HashSet<IntPtr>();
  Form main;readonly string session;readonly bool browser;string lastError=null;
  IntPtr pointerTarget=IntPtr.Zero;
  int pendingEdits=0;
  string displayLanguage="en";Dictionary<string,object> translations=new Dictionary<string,object>();
  readonly Dictionary<object,string[]> displayedTexts=new Dictionary<object,string[]>();
  readonly Dictionary<IntPtr,string[]> nativeTexts=new Dictionary<IntPtr,string[]>();
  readonly HashSet<Control> paintedControls=new HashSet<Control>();
  HashSet<string> protectedData=new HashSet<string>();
  static string Normalize(string value){return value.Replace("&","").Trim().TrimEnd('.','…',':','：').Trim().ToLowerInvariant();}
  string DisplayText(string text){
   if(displayLanguage=="en"||String.IsNullOrEmpty(text))return text;
   object value;string translated=null;
   if(text.TrimStart().StartsWith("| Selected: "))translated="| 已选："+text.TrimStart().Substring(12);
   else if(translations.TryGetValue(Normalize(text),out value))translated=Text(value);
   else{
    foreach(string prefix in new[]{"Current farm data is exported to files: Text files and","Current repository data is exported to files: Text files and"})if(text.StartsWith(prefix)&&translations.TryGetValue(Normalize(prefix),out value)){translated=Text(value)+text.Substring(prefix.Length);break;}
    var match=System.Text.RegularExpressions.Regex.Match(text,@"^(.+?)\s+\((\d+)\)$");if(translated==null&&match.Success&&translations.TryGetValue(Normalize(match.Groups[1].Value),out value))translated=Text(value)+" ("+match.Groups[2].Value+")";
   }
   if(translated==null)return text;
   return displayLanguage=="both"?translated+" / "+text.Replace("&",""):translated;
  }
  string DisplayValue(string text){return protectedData.Contains(text)?text:DisplayText(text);}
  void Caption(object identity,string text,Action<string> set){string actual=text;string[] prior;if(displayedTexts.TryGetValue(identity,out prior)&&text==prior[1])text=prior[0];var translated=identity is Control&&((Control)identity).GetType().Name.StartsWith("OutputLabel")?DisplayValue(text):DisplayText(text);displayedTexts[identity]=new[]{text,translated};if(translated!=actual)set(translated);}
  void PresentItem(ToolStripItem item){Caption(item,item.Text,value=>item.Text=value);var drop=item as ToolStripDropDownItem;if(drop!=null)foreach(ToolStripItem child in drop.DropDownItems)PresentItem(child);}
  void PresentControl(Control c){
   if(c.IsDisposed)return;
   if(c is Label||c is ButtonBase||c is GroupBox||c is Form||c is TabPage)Caption(c,c.Text,value=>c.Text=value);
   var strip=c as ToolStrip;if(strip!=null)foreach(ToolStripItem item in strip.Items)PresentItem(item);
   var grid=c as DataGridView;if(grid!=null&&paintedControls.Add(c))grid.CellPainting+=(sender,e)=>{
    if(e.Value==null||!(e.Value is string)||e.RowIndex>=0&&!grid[e.ColumnIndex,e.RowIndex].ReadOnly)return;string text=Text(e.FormattedValue),translated=DisplayValue(text);if(translated==text)return;
    // Paint only: column identities, headers, values and model bindings stay intact.
    e.Paint(e.ClipBounds,e.PaintParts&~DataGridViewPaintParts.ContentForeground);var rect=e.CellBounds;rect.Inflate(-3,-2);var flags=TextFormatFlags.VerticalCenter|TextFormatFlags.WordBreak|TextFormatFlags.EndEllipsis;
    using(var font=new Font(grid.Font.FontFamily,displayLanguage=="both"?Math.Max(6,Math.Min(grid.Font.SizeInPoints,rect.Height*.3f)):grid.Font.SizeInPoints))TextRenderer.DrawText(e.Graphics,translated,font,rect,(e.State&DataGridViewElementStates.Selected)!=0?e.CellStyle.SelectionForeColor:e.CellStyle.ForeColor,flags);e.Handled=true;
   };
   var tree=c as TreeView;if(tree!=null&&tree.DrawMode==TreeViewDrawMode.Normal&&paintedControls.Add(c)){tree.DrawMode=TreeViewDrawMode.OwnerDrawText;tree.DrawNode+=(sender,e)=>{var translated=DisplayValue(e.Node.Text);if(translated==e.Node.Text){e.DrawDefault=true;return;}bool selected=(e.State&TreeNodeStates.Selected)!=0;var rect=e.Bounds;rect.Width=Math.Max(rect.Width,tree.ClientSize.Width-rect.X);using(var brush=new SolidBrush(selected?SystemColors.Highlight:tree.BackColor))e.Graphics.FillRectangle(brush,rect);TextRenderer.DrawText(e.Graphics,translated,tree.Font,rect,selected?SystemColors.HighlightText:tree.ForeColor,TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);};}
   foreach(Control child in c.Controls)PresentControl(child);
  }
  void PresentNative(IntPtr handle){
   var caption=new StringBuilder(8192);GetWindowText(handle,caption,caption.Capacity);string current=caption.ToString(),original=current;string[] prior;if(nativeTexts.TryGetValue(handle,out prior)&&current==prior[1])original=prior[0];
   string english=original;foreach(var entry in translations)if(Text(entry.Value)==original){english=CultureInfo.InvariantCulture.TextInfo.ToTitleCase(entry.Key);if(entry.Key=="ok")english="OK";break;}
   string translated=DisplayText(english);nativeTexts[handle]=new[]{original,translated};if(current!=translated)SendText(handle,0xC,IntPtr.Zero,translated);
  }
  void Present(){var forms=new List<Form>();foreach(Form form in Application.OpenForms)forms.Add(form);foreach(var form in forms)PresentControl(form);foreach(var handle in Windows())if(Control.FromHandle(handle)==null){PresentNative(handle);EnumChildWindows(handle,(child,unused)=>{var kind=new StringBuilder(128);GetClassName(child,kind,128);if(kind.ToString()=="Button"||kind.ToString()=="Static")PresentNative(child);return true;},IntPtr.Zero);}}
  System.Windows.Forms.Timer timer;
  StreamWriter pipeWriter;readonly object outputLock=new object();TcpListener listener;
  [StructLayout(LayoutKind.Sequential)] struct Rect {public int Left,Top,Right,Bottom;}
  delegate bool EnumWindow(IntPtr hwnd,IntPtr ignored);
  [DllImport("user32.dll")] static extern bool EnumThreadWindows(uint id,EnumWindow callback,IntPtr param);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd,EnumWindow callback,IntPtr param);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr hwnd,int identifier);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd,int index);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int count);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int count);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd,IntPtr hdc,uint flags);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd,uint message,IntPtr wparam,IntPtr lparam);
  [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")] static extern IntPtr SendText(IntPtr hwnd,uint message,IntPtr wparam,string text);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd,uint message,IntPtr wparam,IntPtr lparam);
  [DllImport("user32.dll")] static extern IntPtr GetFocus();
  [DllImport("user32.dll")] static extern IntPtr ChildWindowFromPointEx(IntPtr parent,Point point,uint flags);
  [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr hwnd,ref Point point);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd,ref Point point);
  static IntPtr Param(int x,int y){return new IntPtr((y<<16)|(x&65535));}
  static string Text(object v){return Convert.ToString(v,CultureInfo.InvariantCulture);}
  static int Int(object v){return Convert.ToInt32(v,CultureInfo.InvariantCulture);}
  static Dictionary<string,object> Dict(object v){return (Dictionary<string,object>)v;}
  static object ChoiceMember(object value,string member){if(String.IsNullOrEmpty(member))return value;var row=value as DataRowView;if(row!=null)return row[member];var property=System.ComponentModel.TypeDescriptor.GetProperties(value)[member];return property==null?value:property.GetValue(value);}
  static object Get(object value,string name){if(value==null)return null;for(Type type=value.GetType();type!=null;type=type.BaseType){var f=type.GetField(name,Flags|BindingFlags.DeclaredOnly);if(f!=null)return f.GetValue(value);var p=type.GetProperty(name,Flags|BindingFlags.DeclaredOnly);if(p!=null)return p.GetValue(value,null);}return null;}
  static void Invoke(object obj,string method,params object[] args){for(Type type=obj.GetType();type!=null;type=type.BaseType){var found=type.GetMethod(method,Flags|BindingFlags.DeclaredOnly);if(found!=null){found.Invoke(obj,args);return;}}}
  void Reply(object id,object result,string error=null){lock(outputLock){string line=Json.Serialize(new Dictionary<string,object>{{"id",id},{"ok",error==null},{"result",result},{"error",error}});try{if(pipeWriter!=null){pipeWriter.WriteLine(line);pipeWriter.Flush();}}catch(IOException){pipeWriter=null;}}}
  void ProcessCommand(Dictionary<string,object> command){
   string action=Text(command["action"]);bool edit=action=="value"||action=="cell";
   if(pendingEdits>0&&(edit||action=="snapshot"||action=="results")){commands.Enqueue(command);return;}
   object id=command.ContainsKey("id")?command["id"]:null;if(edit)pendingEdits++;
   try{Reply(id,Handle(command));}catch(Exception ex){lastError=(ex is TargetInvocationException&&ex.InnerException!=null?ex.InnerException:ex).ToString();Reply(id,null,lastError);}finally{if(edit)pendingEdits--;}
  }
  public NativeUi(Form form,string working,bool inBrowser){main=form;session=working;browser=inBrowser;var path=Path.Combine(session,"presentation.json");if(File.Exists(path)){var data=Dict(Json.DeserializeObject(File.ReadAllText(path,Encoding.UTF8)));displayLanguage=Text(data["language"]);translations=Dict(data["translations"]);foreach(var name in (object[])data["protectedNames"])protectedData.Add(Text(name));}}
  void ReceiveCommands(){
   while(true){
    try{
     using(var client=listener.AcceptTcpClient()){
      client.NoDelay=true;var stream=client.GetStream();
      using(var reader=new StreamReader(stream,new UTF8Encoding(false),false,65536,true)){
       var writer=new StreamWriter(stream,new UTF8Encoding(false),65536,true);lock(outputLock)pipeWriter=writer;
       string line;var parser=new JavaScriptSerializer{MaxJsonLength=32*1024*1024};
       while((line=reader.ReadLine())!=null){try{var command=Dict(parser.DeserializeObject(line));if(!command.ContainsKey("token")||Text(command["token"])!=Path.GetFileName(session))throw new ArgumentException("Wrong original session identity");commands.Enqueue(command);}catch(Exception e){Reply(null,null,e.Message);}}
       lock(outputLock)pipeWriter=null;
      }
     }
    }catch(IOException){Thread.Sleep(100);}catch(SocketException){Thread.Sleep(100);}
   }
  }
  public void Run(Func<Form> factory=null){
   listener=new TcpListener(IPAddress.Loopback,0);listener.Start();
   var input=new Thread(ReceiveCommands);input.IsBackground=true;input.Start();
   timer=new System.Windows.Forms.Timer();timer.Interval=60;timer.Tick+=(s,e)=>{Dictionary<string,object> command;if(commands.TryDequeue(out command))ProcessCommand(command);if(displayLanguage!="en")Present();};
   Application.ThreadException+=(s,e)=>{lastError=e.Exception.ToString();};
   var context=new ApplicationContext();EventHandler initialize=null;
   initialize=(sender,eventArgs)=>{Application.Idle-=initialize;try{if(factory!=null)main=factory();if(main==null)throw new InvalidOperationException("Original form unavailable");context.MainForm=main;if(browser)main.Size=new Size(1180,820);main.Show();}catch(Exception e){lastError=e.ToString();}};
   Application.Idle+=initialize;timer.Start();Console.WriteLine("@@FARMUI@@"+Json.Serialize(new{ready=true,port=((IPEndPoint)listener.LocalEndpoint).Port}));Console.Out.Flush();
   Application.Run(context);timer.Stop();
  }
  List<IntPtr> Windows(){var result=new List<IntPtr>();EnumThreadWindows(GetCurrentThreadId(),(h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==System.Diagnostics.Process.GetCurrentProcess().Id&&IsWindowVisible(h))result.Add(h);return true;},IntPtr.Zero);return result;}
  IntPtr Window(object raw){long value;if(!Int64.TryParse(Text(raw),out value))throw new ArgumentException("Invalid original window");var h=new IntPtr(value);if(!Windows().Contains(h))throw new ArgumentException("Original window is no longer open");if(!IsWindowEnabled(h))throw new InvalidOperationException("Complete the active original dialog first");return h;}
  static object[] Bounds(Control c,IntPtr window){var r=c.RectangleToScreen(c.ClientRectangle);Rect w;GetWindowRect(window,out w);return new object[]{r.X-w.Left,r.Y-w.Top,r.Width,r.Height};}
  Dictionary<string,object> Describe(Control c,IntPtr window){
   string id=c.Handle.ToInt64().ToString();controls[id]=c;
   var d=new Dictionary<string,object>{{"id",id},{"name",c.Name},{"type",c.GetType().Name},{"text",c.Text},{"enabled",c.Enabled},{"bounds",Bounds(c,window)}};
   var text=c as TextBoxBase;if(text!=null){d["editable"]=!text.ReadOnly;d["multiline"]=text.Multiline;d["selectionStart"]=text.SelectionStart;}
   if(c.GetType().Name=="DataTextBox"){var property=Get(c,"Property") as PropertyInfo;if(property!=null){d["nativeProperty"]=property.Name;d["nativeValue"]=property.GetValue(Get(c,"DataObject"),null);}d["nativeDoubleClick"]=true;}
   var combo=c as ComboBox;if(combo!=null){var values=new List<object>();foreach(var value in combo.Items)values.Add(combo.GetItemText(value));d["options"]=values;d["selectedIndex"]=combo.SelectedIndex;d["editable"]=combo.DropDownStyle!=ComboBoxStyle.DropDownList;}
   var listBox=c as ListBox;if(listBox!=null){var values=new List<object>();foreach(var value in listBox.Items)values.Add(listBox.GetItemText(value));var selected=new List<int>();foreach(int index in listBox.SelectedIndices)selected.Add(index);d["options"]=values;d["selectedIndex"]=listBox.SelectedIndex;d["selectedIndices"]=selected;d["multiple"]=listBox.SelectionMode==SelectionMode.MultiExtended||listBox.SelectionMode==SelectionMode.MultiSimple;d["nativeDoubleClick"]=true;}
   var progress=c as ProgressBar;if(progress!=null){d["value"]=progress.Value;d["minimum"]=progress.Minimum;d["maximum"]=progress.Maximum;}
   var numeric=c as NumericUpDown;if(numeric!=null){d["value"]=numeric.Value;d["minimum"]=numeric.Minimum;d["maximum"]=numeric.Maximum;d["decimals"]=numeric.DecimalPlaces;}
   var tabs=c as TabControl;if(tabs!=null){var pages=new List<object>();for(int i=0;i<tabs.TabCount;i++)pages.Add(new{index=i,text=tabs.TabPages[i].Text});d["tabs"]=pages;d["selectedIndex"]=tabs.SelectedIndex;}
   var grid=c as DataGridView;if(grid!=null){
    var cells=new List<object>();foreach(DataGridViewRow row in grid.Rows){if(!row.Displayed||row.IsNewRow)continue;foreach(DataGridViewCell cell in row.Cells){if(!cell.Visible)continue;var b=grid.GetCellDisplayRectangle(cell.ColumnIndex,cell.RowIndex,true);if(b.Width<=0||b.Height<=0)continue;var origin=grid.PointToScreen(b.Location);Rect w;GetWindowRect(window,out w);var choices=new List<object>();var choice=cell as DataGridViewComboBoxCell;if(choice!=null)foreach(var v in choice.Items)choices.Add(Text(ChoiceMember(v,choice.DisplayMember)));cells.Add(new Dictionary<string,object>{{"row",cell.RowIndex},{"column",cell.ColumnIndex},{"name",grid.Columns[cell.ColumnIndex].Name},{"text",Text(cell.FormattedValue)},{"value",cell.Value is DBNull?null:cell.Value==null||cell.Value is string||cell.Value.GetType().IsValueType?cell.Value:Text(cell.FormattedValue)},{"readOnly",cell.ReadOnly},{"kind",cell.GetType().Name},{"options",choices},{"bounds",new int[]{origin.X-w.Left,origin.Y-w.Top,b.Width,b.Height}}});}}
    d["cells"]=cells;d["rowCount"]=grid.Rows.Count;
   }
   var tree=c as TreeView;if(tree!=null){var list=new List<object>();foreach(TreeNode node in tree.Nodes)Tree(node,list,id);d["nodes"]=list;}
   var strip=c as ToolStrip;if(strip!=null){var list=new List<object>();foreach(ToolStripItem item in strip.Items)Item(item,list,window,id);d["items"]=list;}
   var listView=c as ListView;if(listView!=null){var list=new List<object>();foreach(ListViewItem item in listView.Items)list.Add(new {index=item.Index,text=item.Text,check=item.Checked,selected=item.Selected});d["entries"]=list;}
   return d;
  }
  void Tree(TreeNode node,List<object> list,string prefix){string id=prefix+":"+node.FullPath;nodes[id]=node;list.Add(new{id=id,text=node.Text,expanded=node.IsExpanded,selected=node.IsSelected});foreach(TreeNode child in node.Nodes)Tree(child,list,prefix);}
  void Item(ToolStripItem item,List<object> list,IntPtr window,string prefix){
   var id=prefix+":"+item.Name+":"+item.Owner.Items.IndexOf(item);items[id]=item;var d=new Dictionary<string,object>{{"id",id},{"name",item.Name},{"text",item.Text},{"enabled",item.Enabled},{"visible",item.Available}};
   var drop=item as ToolStripDropDownItem;if(drop!=null){var sub=new List<object>();foreach(ToolStripItem child in drop.DropDownItems)Item(child,sub,window,id);d["children"]=sub;}
   list.Add(d);
  }
  void Walk(Control c,List<object> list,IntPtr window){if(!c.Visible||c.Width<=0||c.Height<=0)return;list.Add(Describe(c,window));foreach(Control child in c.Controls)Walk(child,list,window);}
  static void Label(List<object> labels,string text,Rectangle rect,Color background,Color foreground,Font font,string align="left"){
   if(String.IsNullOrWhiteSpace(text)||rect.Width<5||rect.Height<5)return;labels.Add(new{text=text,bounds=new[]{rect.X,rect.Y,rect.Width,rect.Height},background=ColorTranslator.ToHtml(background),foreground=ColorTranslator.ToHtml(foreground),fontSize=font.SizeInPoints*96/72,align=align});
  }
  void Labels(Control c,IntPtr window,List<object> labels){
   if(!c.Visible)return;var bounds=Bounds(c,window);var b=new Rectangle(Int(bounds[0]),Int(bounds[1]),Int(bounds[2]),Int(bounds[3]));
   if(c is Label||c is ButtonBase){if(c is CheckBox||c is RadioButton){b.X+=18;b.Width-=20;}else if(c is Button){b.Inflate(-4,-4);}Label(labels,c.Text,b,c.BackColor,c.ForeColor,c.Font,c is Button?"center":"left");}
   if(c is GroupBox){var size=TextRenderer.MeasureText(c.Text,c.Font);b=new Rectangle(b.X+8,b.Y,Math.Min(b.Width-16,size.Width+4),Math.Min(b.Height,size.Height));Label(labels,c.Text,b,c.BackColor,c.ForeColor,c.Font);}
   var tabs=c as TabControl;if(tabs!=null)for(int i=0;i<tabs.TabCount;i++){var tab=tabs.GetTabRect(i);tab.Offset(Int(bounds[0]),Int(bounds[1]));tab.Inflate(-3,-3);Label(labels,tabs.TabPages[i].Text,tab,SystemColors.Control,c.ForeColor,c.Font,"center");}
   var tree=c as TreeView;if(tree!=null){var stack=new Stack<TreeNode>();foreach(TreeNode node in tree.Nodes)stack.Push(node);while(stack.Count>0){var node=stack.Pop();if(node.IsVisible&&!protectedData.Contains(node.Text)){var rect=node.Bounds;rect.Offset(Int(bounds[0]),Int(bounds[1]));Label(labels,node.Text,rect,tree.BackColor,tree.ForeColor,tree.Font);}foreach(TreeNode child in node.Nodes)stack.Push(child);}}
   var grid=c as DataGridView;if(grid!=null){
    foreach(DataGridViewColumn col in grid.Columns)if(col.Visible){var rect=grid.GetCellDisplayRectangle(col.Index,-1,true);rect.Offset(Int(bounds[0]),Int(bounds[1]));rect.Inflate(-3,-2);Label(labels,col.HeaderText,rect,grid.ColumnHeadersDefaultCellStyle.BackColor.IsEmpty?SystemColors.Control:grid.ColumnHeadersDefaultCellStyle.BackColor,grid.ForeColor,grid.Font);}
    foreach(DataGridViewRow row in grid.Rows)if(row.Displayed&&!row.IsNewRow)foreach(DataGridViewCell cell in row.Cells)if(cell.Visible&&cell.ReadOnly&&cell.FormattedValue is string&&!protectedData.Contains(Text(cell.FormattedValue))){var rect=grid.GetCellDisplayRectangle(cell.ColumnIndex,cell.RowIndex,true);rect.Offset(Int(bounds[0]),Int(bounds[1]));rect.Inflate(-3,-2);Label(labels,Text(cell.FormattedValue),rect,cell.InheritedStyle.BackColor,cell.InheritedStyle.ForeColor,grid.Font);}
   }
   var strip=c as ToolStrip;if(strip!=null)foreach(ToolStripItem item in strip.Items)if(item.Available&&!String.IsNullOrEmpty(item.Text)){var rect=item.Bounds;rect.Offset(Int(bounds[0]),Int(bounds[1]));if(item.DisplayStyle==ToolStripItemDisplayStyle.ImageAndText){rect.X+=20;rect.Width-=20;}if(item.DisplayStyle!=ToolStripItemDisplayStyle.Image){rect.Inflate(-3,-3);Label(labels,item.Text,rect,item.BackColor,item.ForeColor,item.Font);}}
   foreach(Control child in c.Controls)Labels(child,window,labels);
  }
  object Frame(bool picture){
   Present();
   if(browser)foreach(Form form in Application.OpenForms)if(form.WindowState==FormWindowState.Minimized)form.WindowState=FormWindowState.Normal;
   controls.Clear();items.Clear();nodes.Clear();nativeControls.Clear();var windows=new List<object>();
   foreach(var h in Windows()){
    Rect r;GetWindowRect(h,out r);int width=r.Right-r.Left,height=r.Bottom-r.Top;if(width<1||height<1||width>5000||height>5000)continue;
    var title=new StringBuilder(512);GetWindowText(h,title,title.Capacity);var type=new StringBuilder(256);GetClassName(h,type,type.Capacity);
    var form=Control.FromHandle(h) as Form;
    var record=new Dictionary<string,object>{{"id",h.ToInt64().ToString()},{"title",title.ToString()},{"className",type.ToString()},{"width",width},{"height",height},{"x",r.Left},{"y",r.Top},{"state",form==null?"native":form.WindowState.ToString()},{"main",form==main}};
    var control=Control.FromHandle(h);var list=new List<object>();if(control!=null)Walk(control,list,h);
    else EnumChildWindows(h,(child,ignored)=>{uint pid;GetWindowThreadProcessId(child,out pid);if(pid!=System.Diagnostics.Process.GetCurrentProcess().Id||!IsWindowVisible(child))return true;var kind=new StringBuilder(128);GetClassName(child,kind,128);var caption=new StringBuilder(4096);GetWindowText(child,caption,4096);Rect b;GetWindowRect(child,out b);nativeControls.Add(child);list.Add(new Dictionary<string,object>{{"id",child.ToInt64().ToString()},{"name",kind.ToString()},{"type",kind.ToString()},{"text",caption.ToString()},{"enabled",true},{"editable",kind.ToString().IndexOf("Edit",StringComparison.OrdinalIgnoreCase)>=0},{"bounds",new int[]{b.Left-r.Left,b.Top-r.Top,b.Right-b.Left,b.Bottom-b.Top}}});return true;},IntPtr.Zero);
    record["controls"]=list;record["folderDialog"]=IsFolderDialog(h);var labels=new List<object>();if(control!=null){Labels(control,h,labels);if(form!=null)Label(labels,form.Text,new Rectangle(8,4,Math.Max(1,width-155),23),SystemColors.ActiveCaption,SystemColors.ActiveCaptionText,form.Font);}
    else foreach(var raw in list){var entry=Dict(raw);if(!entry.ContainsKey("editable")||!Convert.ToBoolean(entry["editable"])){var b=(int[])entry["bounds"];Label(labels,Text(entry["text"]),new Rectangle(b[0]+3,b[1]+2,b[2]-6,b[3]-4),SystemColors.Control,SystemColors.ControlText,SystemFonts.DefaultFont);}}
    record["labels"]=labels;
    if(picture){using(var bmp=new Bitmap(width,height)){using(var graphics=Graphics.FromImage(bmp)){var dc=graphics.GetHdc();try{PrintWindow(h,dc,2);}finally{graphics.ReleaseHdc(dc);}}
      using(var stream=new MemoryStream()){bmp.Save(stream,ImageFormat.Png);record["png"]=Convert.ToBase64String(stream.ToArray());}}}
    windows.Add(record);
   }
   var farm=Get(main,"selectedFarm");return new Dictionary<string,object>{{"windows",windows},{"mode",browser?"browser":"desktop"},{"initializing",main==null},{"pendingChanges",pendingEdits>0},{"sessionId",Path.GetFileName(session)},{"farmId",farm==null?null:Get(farm,"FrmID")},{"warning",lastError},{"engineVersion","4.21.5.0"},{"implementation","unchanged-original-author-forms"}};
  }
  Control NeedControl(object raw){Control value;if(!controls.TryGetValue(Text(raw),out value)||value.IsDisposed||!value.Visible)throw new ArgumentException("Original control changed; refresh the view");return value;}
  bool IsFolderDialog(IntPtr handle){bool found=false;EnumChildWindows(handle,(child,unused)=>{var name=new StringBuilder(128);GetClassName(child,name,128);if(name.ToString()=="SHBrowseForFolder ShellNameSpace Control")found=true;return true;},IntPtr.Zero);return found;}
  string Setting(string name){var type=Assembly.LoadFrom(Path.Combine(session,"Bin","DAL.dll")).GetType("DAL.General.Init.ApplInit");var instance=type.GetProperty("Instance",BindingFlags.Public|BindingFlags.Static).GetValue(null,null);if(!(bool)type.GetMethod("containsKey",new[]{typeof(string)}).Invoke(instance,new object[]{name}))return "";return Text(type.GetMethod("get",new[]{typeof(string)}).Invoke(instance,new object[]{name}));}
  object Directories(){return new Dictionary<string,object>{{"Input",Setting("InputDirectoryPath")},{"Output",Setting("OutputDirectoryPath")},{"networkMetrics",Setting("NetworkMetrics")}};}
  object Handle(Dictionary<string,object> command){
   string action=Text(command["action"]);
   if(action=="frame")return Frame(!command.ContainsKey("picture")||Convert.ToBoolean(command["picture"]));
   if(action=="presentation"){
    string language=Text(command["language"]);if(language!="zh"&&language!="en"&&language!="both")throw new ArgumentException("Unknown display language");displayLanguage=language;translations=Dict(command["translations"]);protectedData.Clear();if(command.ContainsKey("protectedNames"))foreach(var name in (object[])command["protectedNames"])protectedData.Add(Text(name));Present();foreach(Form form in Application.OpenForms)form.Invalidate(true);return new{language=displayLanguage};
   }
   if(action=="snapshot")return Snapshot();
   if(action=="directories")return Directories();
   if(action=="folder-select"){
    var handle=Window(command["window"]);if(!IsFolderDialog(handle))throw new ArgumentException("Choose an open original folder dialog");
    string path=Text(command["path"]);if(!Path.IsPathRooted(path)||!Directory.Exists(path))throw new ArgumentException("Choose an existing absolute folder path");
    SendText(handle,0x467,new IntPtr(1),Path.GetFullPath(path));return new{selected=true};
   }
   if(action=="results"){var model=Get(main,"model");var farm=Get(main,"selectedFarm");var optimization=Get(main,"optim");if(model==null||farm==null||optimization==null)throw new InvalidOperationException("Original model is not initialized");var host=new Host(Path.Combine(session,"Bin"),session);return Json.DeserializeObject(host.GuiResults(model,farm,optimization,Json.Serialize(Snapshot())));}
   if(action=="close"){if(main!=null&&!main.Enabled)throw new InvalidOperationException("Complete the active original dialog before closing the session");if(main!=null)main.BeginInvoke((MethodInvoker)(()=>main.Close()));else Application.ExitThread();return new{closing=true};}
   if(action=="error-clear"){lastError=null;return new{ok=true};}
   if(action=="menu"){ToolStripItem item;if(!items.TryGetValue(Text(command["item"]),out item)||!item.Enabled)throw new ArgumentException("Original menu item unavailable");item.PerformClick();return new{ok=true};}
   if(action=="tree"){TreeNode node;if(!nodes.TryGetValue(Text(command["node"]),out node))throw new ArgumentException("Original tree changed");node.TreeView.SelectedNode=node;if(command.ContainsKey("expand")){if(Convert.ToBoolean(command["expand"]))node.Expand();else node.Collapse();}return new{ok=true};}
   if(action=="control-double"){var c=NeedControl(command["control"]);if(!c.Enabled)throw new InvalidOperationException("Original control is disabled");Invoke(c,"OnDoubleClick",EventArgs.Empty);if(!c.IsDisposed)Invoke(c,"OnMouseDoubleClick",new MouseEventArgs(MouseButtons.Left,2,Math.Min(c.Width-1,10),Math.Min(c.Height-1,10),0));return new{ok=true};}
   if(action=="tab"){var tab=NeedControl(command["control"]) as TabControl;if(tab==null||!tab.Enabled)throw new ArgumentException("Original tab unavailable");tab.SelectedIndex=Int(command["index"]);return new{ok=true};}
   if(action=="value"){
    long rawHandle;if(Int64.TryParse(Text(command["control"]),out rawHandle)&&nativeControls.Contains(new IntPtr(rawHandle))){SendText(new IntPtr(rawHandle),0xC,IntPtr.Zero,Text(command["value"]));return new{ok=true};}
    var c=NeedControl(command["control"]);if(!c.Enabled)throw new ArgumentException("Original control is disabled");var combo=c as ComboBox;var number=c as NumericUpDown;var text=c as TextBoxBase;var list=c as ListBox;
    if(combo!=null){if(command.ContainsKey("index"))combo.SelectedIndex=Int(command["index"]);else combo.Text=Text(command["value"]);}
    else if(number!=null)number.Value=Convert.ToDecimal(command["value"],CultureInfo.InvariantCulture);
    else if(list!=null){if(command.ContainsKey("indices")){list.ClearSelected();foreach(var index in (object[])command["indices"])list.SetSelected(Int(index),true);}else list.SelectedIndex=Int(command["index"]);}
    else if(text!=null&&!text.ReadOnly){text.Text=Text(command["value"]);text.Modified=true;Invoke(text,"OnLeave",EventArgs.Empty);}
    else throw new ArgumentException("The original control is not editable");return new{ok=true};
   }
   if(action=="cell"){
    var grid=NeedControl(command["control"]) as DataGridView;if(grid==null)throw new ArgumentException("Expected original data grid");var cell=grid[Int(command["column"]),Int(command["row"])];if(cell.ReadOnly||!grid.Enabled)throw new ArgumentException("Original cell is read-only");
    grid.CurrentCell=cell;grid.BeginEdit(true);object value=command["value"];var choice=cell as DataGridViewComboBoxCell;if(choice!=null&&command.ContainsKey("index"))value=ChoiceMember(choice.Items[Int(command["index"])],choice.ValueMember);var type=cell.ValueType;if(value!=null&&type!=null&&type!=typeof(object))value=Convert.ChangeType(value,type,CultureInfo.InvariantCulture);cell.Value=value;grid.NotifyCurrentCellDirty(true);grid.CommitEdit(DataGridViewDataErrorContexts.Commit);grid.EndEdit();return new{ok=true};
   }
   if(action=="resize"){var form=Control.FromHandle(Window(command["window"])) as Form;if(form==null)throw new ArgumentException("Original window is not a form");int w=Int(command["width"]),h=Int(command["height"]);if(w<600||w>2400||h<400||h>1800)throw new ArgumentException("Original window dimensions out of range");form.Size=new Size(w,h);return new{ok=true};}
   if(action=="window-close"){var h=Window(command["window"]);PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);return new{ok=true};}
   if(action=="pointer"){
    var h=Window(command["window"]);Rect r;GetWindowRect(h,out r);var screen=new Point(r.Left+Int(command["x"]),r.Top+Int(command["y"]));var point=screen;ScreenToClient(h,ref point);string phase=Text(command["phase"]);
    if(phase=="down"){
     pointerTarget=h;var local=point;
     for(int depth=0;depth<30;depth++){var next=ChildWindowFromPointEx(pointerTarget,local,7);if(next==IntPtr.Zero||next==pointerTarget)break;pointerTarget=next;local=screen;ScreenToClient(pointerTarget,ref local);}
     var control=Control.FromHandle(pointerTarget);if(control!=null){if(!control.Enabled)throw new InvalidOperationException("Complete the active original dialog first");control.Focus();}
    }
    uint pid;if(pointerTarget==IntPtr.Zero||GetWindowThreadProcessId(pointerTarget,out pid)==0||pid!=System.Diagnostics.Process.GetCurrentProcess().Id)throw new ArgumentException("No active original pointer target");
    var p=screen;ScreenToClient(pointerTarget,ref p);SendMessage(pointerTarget,phase=="down"?0x201U:phase=="up"?0x202U:0x200U,phase=="up"?IntPtr.Zero:new IntPtr(1),Param(p.X,p.Y));if(phase=="up")pointerTarget=IntPtr.Zero;return new{ok=true};
   }
   if(action=="click"||action=="scroll"){
    var h=Window(command["window"]);Rect r;GetWindowRect(h,out r);int x=Int(command["x"]),y=Int(command["y"]);if(x<0||y<0||x>=r.Right-r.Left||y>=r.Bottom-r.Top)throw new ArgumentException("Point is outside the original window");
    var screen=new Point(r.Left+x,r.Top+y);var point=screen;ScreenToClient(h,ref point);
    int hit=SendMessage(h,0x84,IntPtr.Zero,Param(screen.X,screen.Y)).ToInt32();
    if(action=="click"&&hit==20){PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);return new{ok=true};}
    if(action=="click"&&hit==9){var f=Control.FromHandle(h) as Form;if(f!=null)f.WindowState=f.WindowState==FormWindowState.Maximized?FormWindowState.Normal:FormWindowState.Maximized;return new{ok=true};}
    var child=h;var local=point;for(int depth=0;depth<30;depth++){var next=ChildWindowFromPointEx(child,local,7);if(next==IntPtr.Zero||next==child)break;child=next;local=screen;ScreenToClient(child,ref local);}
    var c=Control.FromHandle(child);
    if(c!=null&&!c.Enabled)throw new InvalidOperationException("Complete the active original dialog first");
    if(action=="scroll"){
     int delta=Int(command["delta"]);var grid=c as DataGridView;if(grid!=null&&grid.RowCount>0){int start=Math.Max(0,grid.FirstDisplayedScrollingRowIndex);grid.FirstDisplayedScrollingRowIndex=Math.Max(0,Math.Min(grid.RowCount-1,start+(delta>0?3:-3)));}
     else SendMessage(child,0x20A,new IntPtr((delta>0?-120:120)<<16),Param(screen.X,screen.Y));return new{ok=true};
    }
    bool right=command.ContainsKey("button")&&Text(command["button"])=="right",twice=command.ContainsKey("double")&&Convert.ToBoolean(command["double"]);
    var strip=c as ToolStrip;if(strip!=null&&!right){var item=strip.GetItemAt(local);if(item!=null&&item.Enabled){var drop=item as ToolStripDropDownItem;if(drop!=null&&drop.HasDropDownItems)drop.ShowDropDown();else item.PerformClick();return new{ok=true};}}
    var tree=c as TreeView;if(tree!=null){var hitNode=tree.HitTest(local);if(hitNode.Node!=null){tree.SelectedNode=hitNode.Node;if((hitNode.Location&TreeViewHitTestLocations.PlusMinus)!=0||twice)hitNode.Node.Toggle();if(right&&tree.ContextMenuStrip!=null)tree.ContextMenuStrip.Show(tree,local);return new{ok=true};}}
    var tabs=c as TabControl;if(tabs!=null){for(int i=0;i<tabs.TabCount;i++)if(tabs.GetTabRect(i).Contains(local)){tabs.SelectedIndex=i;return new{ok=true};}}
    var button=c as Button;if(button!=null&&!right){button.PerformClick();return new{ok=true};}
    var check=c as CheckBox;if(check!=null&&!right){check.Checked=!check.Checked;return new{ok=true};}
    var radio=c as RadioButton;if(radio!=null&&!right){radio.Checked=true;return new{ok=true};}
    if(c!=null)c.Focus();
    SendMessage(child,0x200,IntPtr.Zero,Param(local.X,local.Y));SendMessage(child,right?0x204U:twice?0x203U:0x201U,new IntPtr(right?2:1),Param(local.X,local.Y));SendMessage(child,right?0x205U:0x202U,IntPtr.Zero,Param(local.X,local.Y));return new{ok=true};
   }
   if(action=="key"){
    var h=Window(command["window"]);var focus=GetFocus();uint pid;if(focus==IntPtr.Zero||GetWindowThreadProcessId(focus,out pid)==0||pid!=System.Diagnostics.Process.GetCurrentProcess().Id)focus=h;
    var c=Control.FromHandle(focus)??Control.FromHandle(h);var key=(Keys)Enum.Parse(typeof(Keys),Text(command["key"]),true);if(command.ContainsKey("ctrl")&&Convert.ToBoolean(command["ctrl"]))key|=Keys.Control;if(command.ContainsKey("shift")&&Convert.ToBoolean(command["shift"]))key|=Keys.Shift;if(command.ContainsKey("alt")&&Convert.ToBoolean(command["alt"]))key|=Keys.Alt;
    if(!(Control.FromHandle(h) is Form)&&(key==Keys.Enter||key==Keys.Escape)){
     int button=key==Keys.Escape?2:SendMessage(h,0x400,IntPtr.Zero,IntPtr.Zero).ToInt32()&65535;if(button==0)button=1;var target=GetDlgItem(h,button);var candidates=new List<IntPtr>();
     EnumChildWindows(h,(child,unused)=>{var kind=new StringBuilder(128);GetClassName(child,kind,128);if(kind.ToString()=="Button"&&IsWindowVisible(child)&&IsWindowEnabled(child)){candidates.Add(child);if(GetDlgCtrlID(child)==button)target=child;}return true;},IntPtr.Zero);
     if(target==IntPtr.Zero&&key==Keys.Enter)foreach(var child in candidates)if((SendMessage(child,0x87,IntPtr.Zero,IntPtr.Zero).ToInt64()&0x10)!=0||(GetWindowLong(child,-16)&15)==1){target=child;break;}
     if(target==IntPtr.Zero&&candidates.Count==1)target=candidates[0];
     if(target!=IntPtr.Zero&&IsWindowEnabled(target)){Rect windowBounds,buttonBounds;GetWindowRect(h,out windowBounds);GetWindowRect(target,out buttonBounds);return Handle(new Dictionary<string,object>{{"action","click"},{"window",h.ToInt64().ToString()},{"x",(buttonBounds.Left+buttonBounds.Right)/2-windowBounds.Left},{"y",(buttonBounds.Top+buttonBounds.Bottom)/2-windowBounds.Top}});}
     PostMessage(h,0x111,new IntPtr(button),target);return new{ok=true};
    }
    if(c!=null){var message=Message.Create(focus,0x100,new IntPtr((int)(key&Keys.KeyCode)),IntPtr.Zero);object[] args={message,key};var method=typeof(Control).GetMethod("ProcessCmdKey",Flags);bool done=(bool)method.Invoke(c,args);if(!done){var dialog=typeof(Control).GetMethod("ProcessDialogKey",Flags);done=(bool)dialog.Invoke(c,new object[]{key});}if(done)return new{ok=true};}
    SendMessage(focus,0x100,new IntPtr((int)(key&Keys.KeyCode)),IntPtr.Zero);SendMessage(focus,0x101,new IntPtr((int)(key&Keys.KeyCode)),IntPtr.Zero);return new{ok=true};
   }
   throw new ArgumentException("Unknown original UI operation");
  }
  object Snapshot(){
   if(main!=null&&!main.Enabled)throw new InvalidOperationException("Complete the active original dialog before pulling or exporting inputs");
   var farm=Get(main,"selectedFarm");if(farm==null)throw new InvalidOperationException("No original farm selected");int id=Int(Get(farm,"FrmID"));
   var input=new Dictionary<string,object>();var auxiliary=new Dictionary<string,object>();var opt=new Dictionary<string,object>();
   string inputDirectory=Setting("InputDirectoryPath");
   using(var conn=new FreshConnection(Path.Combine(inputDirectory,"FarmDB.mdb"))){
    var scoped=new Dictionary<string,List<Dictionary<string,object>>>();
    foreach(string table in new string[]{"FRM","ENV","ECN","ROT","RCR","CRP","PRD","ANM","APR","ARR","MAN","FRT","CFR","CMR","PST","CPR","GRP","GCR","MCH","BLD","HHD","HMR","DRI","DRF","NTE","PHO","VRS"}){
     var rows=Rows(conn,table,null);if(table!="DRI"&&table!="DRF"&&table!="VRS"&&rows.Count>0&&rows[0].ContainsKey("FrmID"))rows.RemoveAll(row=>Int(row["FrmID"])!=id);scoped[table]=rows;
    }
    // Relation tables have no FrmID: scope them through their actual parent keys.
    foreach(var link in new[]{new[]{"RCR","RotID","ROT","RotID"},new[]{"PRD","CrpID","CRP","CrpID"},new[]{"APR","AnmID","ANM","AnmID"},new[]{"ARR","AnmID","ANM","AnmID"},new[]{"CFR","CrpID","CRP","CrpID"},new[]{"CMR","CrpID","CRP","CrpID"},new[]{"CPR","CrpID","CRP","CrpID"},new[]{"GCR","GrpID","GRP","GrpID"},new[]{"HMR","HhdID","HHD","HhdID"}}){var parentIds=new HashSet<int>();foreach(var row in scoped[link[2]])parentIds.Add(Int(row[link[3]]));scoped[link[0]].RemoveAll(row=>!parentIds.Contains(Int(row[link[1]])));}
    foreach(var pair in scoped){if(pair.Key=="NTE"||pair.Key=="PHO"||pair.Key=="VRS")auxiliary[pair.Key]=pair.Value;else input[pair.Key]=pair.Value;}
   }
   using(var conn=new FreshConnection(Path.Combine(inputDirectory,"de.mdb"))){foreach(var pair in new string[][]{new[]{"DVR","variables"},new[]{"OUV","indicators"},new[]{"VAR","displayVariables"}})opt[pair[1]]=Rows(conn,pair[0],pair[0]=="VAR"?(int?)null:id);var allOutcomes=Rows(conn,"OUV",null);allOutcomes.RemoveAll(row=>Int(row["CasID"])==id);opt["referenceIndicators"]=allOutcomes;var settings=Rows(conn,"DEP",null);opt["settings"]=settings.Count>0?settings[0]:null;opt["versionRecords"]=Rows(conn,"VRS",null);}
   return new Dictionary<string,object>{{"schema","FarmSystemDesign.FarmDESIGN.NativeTables"},{"schemaVersion",1},{"farmId",id},{"tables",input},{"auxiliaryTables",auxiliary},{"optimization",opt},{"provenance",new{kind="original-gui-session",engineVersion="4.21.5.0"}}};
  }
  List<Dictionary<string,object>> Rows(FreshConnection conn,string table,int? farm){
   string sql="SELECT * FROM ["+table+"]"+(farm.HasValue?" WHERE [CasID]="+farm.Value:"");
   // Read through the author's active writer connection, then wait until the
   // independent Jet reader sees the same rows. A fresh reader alone can lag
   // behind an implicit transaction, producing an out-of-date pull or MDB copy.
   string database=conn.Database;
   var type=Assembly.LoadFrom(Path.Combine(session,"Bin","DAL.dll")).GetType("DAL.General.DBConnectionManager");var manager=type.GetProperty("Instance",BindingFlags.Public|BindingFlags.Static).GetValue(null,null);var writer=(IDbConnection)type.GetMethod("GetConnection").Invoke(manager,new object[]{database});bool opened=writer.State==ConnectionState.Closed;
   var expected=new List<Dictionary<string,object>>();try{if(opened)writer.Open();using(var command=writer.CreateCommand()){command.CommandText=sql;using(var reader=command.ExecuteReader()){while(reader.Read()){var row=new Dictionary<string,object>();for(int i=0;i<reader.FieldCount;i++)row[reader.GetName(i)]=reader.IsDBNull(i)?null:reader.GetValue(i);expected.Add(row);}}}}finally{if(opened)writer.Close();}
   string reference=Json.Serialize(expected);var deadline=DateTime.UtcNow.AddSeconds(5);
   while(true){
    conn.Refresh();dynamic record=conn.Value.Execute(sql);var rows=new List<Dictionary<string,object>>();try{while(!record.EOF){var item=new Dictionary<string,object>();for(int i=0;i<record.Fields.Count;i++){dynamic field=record.Fields[i];object value=field.Value;item[Text(field.Name)]=value is DBNull?null:value;Marshal.FinalReleaseComObject(field);}rows.Add(item);record.MoveNext();}}finally{record.Close();Marshal.FinalReleaseComObject(record);}
    if(Json.Serialize(rows)==reference)return rows;
    if(DateTime.UtcNow>=deadline)throw new InvalidOperationException("Original database is still saving. Wait for it to finish, then pull or export again.");Thread.Sleep(40);
   }
  }
 }
}
