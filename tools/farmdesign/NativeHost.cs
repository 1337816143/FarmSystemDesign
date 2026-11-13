// Local adapter for the unchanged author assemblies. No FarmDESIGN equations are reimplemented.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Xml;
using System.Xml.Serialization;
using System.Text;

namespace FarmSystemNative {
 public sealed class Host : IDisposable {
  const BindingFlags Flags=BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static;
  readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=16*1024*1024,RecursionLimit=100};
  readonly Assembly dal,exe; readonly string session; readonly object directory;
  object model,farm,optimization; Dictionary<string,object> document;
  List<Dictionary<string,object>> catalog=new List<Dictionary<string,object>>();
  Dictionary<string,object> searchConfig; string binPath;
  readonly Dictionary<string,string[]> descriptions=new Dictionary<string,string[]>();
  readonly string[] tables={"FRM","ENV","ECN","ROT","CRP","RCR","PRD","ANM","APR","ARR","MAN","FRT","CFR","CMR","PST","CPR","GRP","GCR","MCH","BLD","HHD","HMR","DRI","DRF"};
  readonly string[] modules={"Areas","FeedBalances","FeedSelfSupply","NutrientFlows","NutrientFlowsPerHa","OmBalance","OmBalancePerHa","Labour","Manures","Pesticides","Energy","GHGs","Nutrition","Budget","NutrientFlowMatrix","EconResults","ProductAmounts","WaterUse","BeddingUse","ManureProd"};
  public Host(string bin,string working) {
   session=working;binPath=bin; dal=Assembly.LoadFrom(Path.Combine(bin,"DAL.dll"));exe=Assembly.LoadFrom(Path.Combine(bin,"FarmDESIGN.exe"));
   directory=Create(dal.GetType("DAL.General.DirectoryHolder"),Path.Combine(session,"Output")+Path.DirectorySeparatorChar);
   foreach(var line in File.ReadAllLines(Path.Combine(bin,"Files","Translations.E.EN.txt"),Encoding.GetEncoding(1252))){var parts=line.Split('\t');if(parts.Length>=4&&!descriptions.ContainsKey(parts[0]))descriptions[parts[0]]=parts;}
  }
  object Create(Type type,params object[] args){return Activator.CreateInstance(type,Flags,null,args,CultureInfo.InvariantCulture);}
  static object Get(object target,string name){for(var type=target.GetType();type!=null;type=type.BaseType){var property=type.GetProperty(name,Flags|BindingFlags.DeclaredOnly);if(property!=null)return property.GetValue(target,null);var field=type.GetField(name,Flags|BindingFlags.DeclaredOnly);if(field!=null)return field.GetValue(target);}throw new InvalidOperationException("Native member unavailable: "+target.GetType().FullName+"."+name);}
  static object Call(object target,string method,params object[] args){try{MethodInfo selected=null;foreach(var candidate in target.GetType().GetMethods(Flags)){if(candidate.Name!=method)continue;var parameters=candidate.GetParameters();if(parameters.Length!=args.Length)continue;bool valid=true;for(int i=0;i<parameters.Length;i++){var type=parameters[i].ParameterType;if(args[i]!=null&&!type.IsInstanceOfType(args[i])){valid=false;break;}if(args[i]==null&&type.IsValueType){valid=false;break;}}if(valid&&(selected==null||candidate.DeclaringType==target.GetType()))selected=candidate;}if(selected==null)throw new MissingMethodException(target.GetType().FullName,method);return selected.Invoke(target,args);}catch(TargetInvocationException e){throw new InvalidOperationException("Original FarmDESIGN "+method+" failed: "+(e.InnerException??e).ToString(),e.InnerException??e);}}
  static Dictionary<string,object> Dict(object value){return (Dictionary<string,object>)value;}
  static object[] ArrayOf(object value){return value as object[]??new object[0];}
  static string Text(object value){return Convert.ToString(value,CultureInfo.InvariantCulture);}
  static double Number(object value){return Convert.ToDouble(value,CultureInfo.InvariantCulture);}
  string Quoted(string value){return "["+value.Replace("]", "]]")+"]";}

  void WriteDatabase(string database,Dictionary<string,object> data,string[] orderedTables){
   var db=Path.Combine(session,"Input",database);
   using(var conn=new OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source="+db+";")){
    conn.Open();using(var transaction=conn.BeginTransaction()){
     // This database is a disposable, per-worker copy. All writes are parameterized.
     for(int i=orderedTables.Length-1;i>=0;i--)using(var command=new OleDbCommand("DELETE FROM "+Quoted(orderedTables[i]),conn,transaction))command.ExecuteNonQuery();
     foreach(var name in orderedTables){
      if(!data.ContainsKey(name))continue;
      var schema=new DataTable();using(var adapter=new OleDbDataAdapter("SELECT * FROM "+Quoted(name)+" WHERE 1=0",conn)){adapter.SelectCommand.Transaction=transaction;adapter.FillSchema(schema,SchemaType.Source);}
      foreach(var item in ArrayOf(data[name])){
       var row=Dict(item);var fields=new List<string>();var marks=new List<string>();
       using(var command=new OleDbCommand()){command.Connection=conn;command.Transaction=transaction;
        foreach(var pair in row){if(!schema.Columns.Contains(pair.Key))throw new InvalidOperationException("Unknown native column "+name+"."+pair.Key);fields.Add(Quoted(pair.Key));marks.Add("?");var type=schema.Columns[pair.Key].DataType;var value=pair.Value;
         if(value!=null){if(type==typeof(bool))value=Convert.ToBoolean(value,CultureInfo.InvariantCulture);else if(type==typeof(int)){double n=Number(value);if(n!=Math.Truncate(n))throw new InvalidOperationException(name+"."+pair.Key+" requires an integer");value=Convert.ToInt32(value,CultureInfo.InvariantCulture);}else if(type==typeof(double))value=Number(value);else if(type==typeof(string))value=Text(value);}
         OleDbType dbtype=type==typeof(bool)?OleDbType.Boolean:type==typeof(int)?OleDbType.Integer:type==typeof(double)?OleDbType.Double:OleDbType.LongVarWChar;
         var parameter=command.Parameters.Add("p"+command.Parameters.Count,dbtype);parameter.Value=value??DBNull.Value;
        }
        command.CommandText="INSERT INTO "+Quoted(name)+" ("+String.Join(",",fields.ToArray())+") VALUES ("+String.Join(",",marks.ToArray())+")";command.ExecuteNonQuery();
       }
      }
     }
     transaction.Commit();
    }
   }
  }
  void WriteHeuristics(Dictionary<string,object> config){
   var data=new Dictionary<string,object>();var ordered=new List<string>{"DEP","DVR","OUV"};
   var reference=!config.ContainsKey("displayVariables")||!config.ContainsKey("referenceIndicators")?ReferenceData("de.mdb"):null;
   foreach(var pair in new[]{new[]{"DVR","variables"},new[]{"OUV","indicators"}}){var rows=new List<object>();var used=new HashSet<int>();foreach(var raw in ArrayOf(config[pair[1]])){var row=new Dictionary<string,object>(Dict(raw));row["CasID"]=document["farmId"];rows.Add(row);if(pair[0]=="OUV")used.Add(Convert.ToInt32(row["OuvID"]));}if(pair[0]=="OUV")foreach(var raw in ArrayOf(config.ContainsKey("referenceIndicators")?config["referenceIndicators"]:reference["OUV"])){var row=Dict(raw);if(!used.Contains(Convert.ToInt32(row["OuvID"])))rows.Add(row);}data[pair[0]]=rows.ToArray();}
   data["DEP"]=new object[]{config["settings"]};
   data["VAR"]=config.ContainsKey("displayVariables")?config["displayVariables"]:reference["VAR"];ordered.Add("VAR");
   if(config.ContainsKey("versionRecords")){data["VRS"]=config["versionRecords"];ordered.Add("VRS");}
   WriteDatabase("de.mdb",data,ordered.ToArray());
  }
  public string Load(string input){
   DisposeModel();document=Dict(json.DeserializeObject(input));PrepareAttachments();var dataTables=new Dictionary<string,object>(Dict(document["tables"]));var loadTables=new List<string>(tables);if(document.ContainsKey("auxiliaryTables")){var extra=Dict(document["auxiliaryTables"]);foreach(var name in new string[]{"NTE","PHO","VRS"})if(extra.ContainsKey(name)){dataTables[name]=extra[name];loadTables.Add(name);}}WriteDatabase("FarmDB.mdb",dataTables,loadTables.ToArray());
   if(document.ContainsKey("optimization"))WriteHeuristics(Dict(document["optimization"]));
   var dao=Create(dal.GetType("DAL.Domain.FarmDESIGN.DAO.MixedFarmDAO"));farm=Call(dao,"SelectById",Convert.ToInt32(document["farmId"]));
   model=Create(exe.GetType("Design.Model.FarmSimulation"),directory);Call(model,"Init",farm,new object());Call(model,"Calc");
   optimization=Create(exe.GetType("Design.Model.FarmOptimization"),directory);optimization.GetType().GetProperty("Model",Flags).SetValue(optimization,model,null);
   var initialHeur=Create(dal.GetType("DAL.Domain.Heuristics.EntityCollections.HeuristicsData"));Call(initialHeur,"SelectByCase",(object)new object[]{document["farmId"]});optimization.GetType().GetProperty("HeurData",Flags).SetValue(optimization,initialHeur,null);Call(optimization,"Init",model,null);
   BuildCatalog();
   return Evaluate(false);
  }
  public string StageGui(string input){
   DisposeModel();document=Dict(json.DeserializeObject(input));PrepareAttachments();var data=new Dictionary<string,object>(Dict(document["tables"]));var original=ReferenceData("FarmDB.mdb");var names=new List<string>(tables);
   var extra=document.ContainsKey("auxiliaryTables")?Dict(document["auxiliaryTables"]):new Dictionary<string,object>();foreach(var name in new[]{"NTE","PHO"}){data[name]=extra.ContainsKey(name)?extra[name]:new object[0];names.Add(name);}if(extra.ContainsKey("VRS")){data["VRS"]=extra["VRS"];names.Add("VRS");}
   var repository=MergeRepository(data,original);
   WriteDatabase("FarmDB.mdb",data,names.ToArray());
   if(document.ContainsKey("optimization"))WriteHeuristics(Dict(document["optimization"]));
   return json.Serialize(new{staged=true,farmId=document["farmId"],repository=repository});
  }
  Dictionary<string,int> MergeRepository(Dictionary<string,object> data,Dictionary<string,object> original){
   var links=new[]{new[]{"RCR","RotID","ROT","RotID"},new[]{"RCR","CrpID","CRP","CrpID"},new[]{"PRD","CrpID","CRP","CrpID"},new[]{"APR","AnmID","ANM","AnmID"},new[]{"ARR","AnmID","ANM","AnmID"},new[]{"ARR","RepID","ANM","AnmID"},new[]{"CFR","CrpID","CRP","CrpID"},new[]{"CFR","FrtID","FRT","FrtID"},new[]{"CMR","CrpID","CRP","CrpID"},new[]{"CMR","ManID","MAN","ManID"},new[]{"CPR","CrpID","CRP","CrpID"},new[]{"CPR","PstID","PST","PstID"},new[]{"GCR","GrpID","GRP","GrpID"},new[]{"GCR","CrpID","CRP","CrpID"},new[]{"HMR","HhdID","HHD","HhdID"}};
   var keys=new Dictionary<string,string>{{"FRM","FrmID"},{"ENV","EnvID"},{"ECN","EcnID"},{"ROT","RotID"},{"RCR","RcrID"},{"CRP","CrpID"},{"PRD","PrdID"},{"ANM","AnmID"},{"APR","AprID"},{"ARR","ArrID"},{"MAN","ManID"},{"FRT","FrtID"},{"CFR","CfrID"},{"CMR","CmrID"},{"PST","PstID"},{"CPR","CprID"},{"GRP","GrpID"},{"GCR","GcrID"},{"MCH","MchID"},{"BLD","BldID"},{"HHD","HhdID"},{"HMR","HmrID"}};
   var repo=new Dictionary<string,List<Dictionary<string,object>>>();
   foreach(var pair in original){if(pair.Key=="DRI"||pair.Key=="DRF"||pair.Key=="VRS")continue;var rows=new List<Dictionary<string,object>>();foreach(var raw in ArrayOf(pair.Value)){var row=Dict(raw);if(row.ContainsKey("FrmID")&&Number(row["FrmID"])==0)rows.Add(new Dictionary<string,object>(row));}repo[pair.Key]=rows;}
   var scoped=new HashSet<string>();foreach(var link in links)if(scoped.Add(link[0])){var ids=new HashSet<int>();foreach(var row in repo[link[2]])ids.Add(Convert.ToInt32(row[link[3]]));foreach(var raw in ArrayOf(original[link[0]])){var row=Dict(raw);if(!row.ContainsKey("FrmID")&&ids.Contains(Convert.ToInt32(row[link[1]])))repo[link[0]].Add(new Dictionary<string,object>(row));}}
   // Project identifiers remain exact. Only colliding repository-copy identifiers move.
   var remap=new Dictionary<string,Dictionary<int,int>>();foreach(var pair in keys){var used=new HashSet<int>();foreach(var raw in ArrayOf(data[pair.Key]))used.Add(Convert.ToInt32(Dict(raw)[pair.Value]));int next=0;foreach(var id in used)next=Math.Max(next,id);foreach(var row in repo[pair.Key])next=Math.Max(next,Convert.ToInt32(row[pair.Value]));var changes=new Dictionary<int,int>();foreach(var row in repo[pair.Key]){int id=Convert.ToInt32(row[pair.Value]);if(used.Contains(id)){if(next==Int32.MaxValue)throw new InvalidOperationException("Repository identifier range exhausted");changes[id]=++next;row[pair.Value]=next;}}remap[pair.Key]=changes;}
   foreach(var link in links)foreach(var row in repo[link[0]]){int old=Convert.ToInt32(row[link[1]]);if(remap[link[2]].ContainsKey(old))row[link[1]]=remap[link[2]][old];}
   var types=new Dictionary<string,string>{{"MixedFarm","FRM"},{"Environm","ENV"},{"Environment","ENV"},{"Economics","ECN"},{"Rotation","ROT"},{"RotationCrop","RCR"},{"Crop","CRP"},{"CropProduct","PRD"},{"Animal","ANM"},{"AnimalProduct","APR"},{"AnimalReplacement","ARR"},{"Manure","MAN"},{"Fertilizer","FRT"},{"CropFertilizer","CFR"},{"CropManure","CMR"},{"Pesticide","PST"},{"CropPesticide","CPR"},{"Group","GRP"},{"GroupCrop","GCR"},{"Machine","MCH"},{"Building","BLD"},{"Household","HHD"},{"HouseholdMember","HMR"}};
   foreach(var table in new[]{"NTE","PHO"})foreach(var row in repo[table]){string name=Text(row["Name"]);int dot=name.LastIndexOf('.'),id;string target;if(dot>0&&types.TryGetValue(name.Substring(0,dot),out target)&&Int32.TryParse(name.Substring(dot+1),out id)&&remap[target].ContainsKey(id))row["Name"]=name.Substring(0,dot+1)+remap[target][id];}
   var summary=new Dictionary<string,int>();foreach(var pair in repo){var rows=new List<object>(data.ContainsKey(pair.Key)?ArrayOf(data[pair.Key]):new object[0]);rows.AddRange(pair.Value);data[pair.Key]=rows.ToArray();summary[pair.Key]=pair.Value.Count;}return summary;
  }
  void PrepareAttachments(){
   var frm=Dict(ArrayOf(Dict(document["tables"])["FRM"])[0]);var name=Text(frm["Name"]);if(name.IndexOfAny(Path.GetInvalidFileNameChars())>=0||name=="."||name=="..")throw new InvalidOperationException("Use a farm name without Windows filename separators");
   var prefix=Path.Combine(session,"Input",name.Replace(' ','_')+".FD.");
   var entries=new string[][]{new string[]{"dendrogram","Dendrogram"},new string[]{"mapping","Mapping"},new string[]{"products","Products"}};
   var fd=document.ContainsKey("functionalDiversity")&&document["functionalDiversity"]!=null?Dict(document["functionalDiversity"]):null;
   foreach(var entry in entries){var file=prefix+entry[1]+".txt";if(fd!=null)File.WriteAllText(file,Text(fd[entry[0]]),new UTF8Encoding(false));else if(File.Exists(file))File.Delete(file);}
  }

  object Pointer(string method,string entity,object id,string property){return Call(optimization,method,entity,id,property);}
  object[] ResolvePointer(object pointer){if(pointer==null)throw new InvalidOperationException("Native parameter not found");return new object[]{Get(pointer,"Object"),Get(pointer,"Property")};}
  object SetVariable(Dictionary<string,object> variable,object value){
   var pointer=ResolvePointer(Pointer("FindDecisionVariableInModel",Text(variable["EntityType"]),Convert.ToInt32(variable["ObjID"]),Text(variable["Variable"])));
   var property=(PropertyInfo)pointer[1];if(!property.CanWrite)throw new InvalidOperationException("Native parameter is read-only");
   var targetType=property.PropertyType;var converted=Convert.ChangeType(value,targetType,CultureInfo.InvariantCulture);property.SetValue(pointer[0],converted,null);return property.GetValue(pointer[0],null);
  }
  object NativeOutcome(Dictionary<string,object> variable){var pointer=ResolvePointer(Pointer("FindOutcomeVariableInModel",Text(variable["EntityType"]),Text(variable["ObjName"]),Text(variable["Variable"])));return ((PropertyInfo)pointer[1]).GetValue(pointer[0],null);}

  public string Variables(string text){var values=ArrayOf(json.DeserializeObject(text));var applied=new List<object>();foreach(var value in values){var item=Dict(value);applied.Add(SetVariable(item,item["value"]));}Call(model,"Calc");var output=Dict(json.DeserializeObject(Evaluate(false)));output["appliedValues"]=applied;return json.Serialize(output);}
  public string GuiResults(object guiModel,object guiFarm,object guiOptimization,string snapshot){document=Dict(json.DeserializeObject(snapshot));model=guiModel;farm=guiFarm;optimization=guiOptimization;BuildCatalog();return Evaluate(false);}
  void AddCatalog(object obj,string entity,string objName,string source,HashSet<string> seen){
   if(obj==null)return;foreach(var p in obj.GetType().GetProperties(Flags)){
    if(p.GetIndexParameters().Length!=0||!(p.PropertyType==typeof(double)||p.PropertyType==typeof(float)||p.PropertyType==typeof(int)||p.PropertyType==typeof(long)))continue;
    var key=entity+":"+objName+":"+p.Name;if(!seen.Add(key))continue;
    try{var pointer=ResolvePointer(Pointer("FindOutcomeVariableInModel",entity,objName,p.Name));if(pointer[0]==null||pointer[1]==null)continue;catalog.Add(new Dictionary<string,object>{{"EntityType",entity},{"ObjName",objName},{"Variable",p.Name},{"key",key},{"source",source}});}catch{}
   }
  }
  void BuildCatalog(){
   catalog.Clear();var seen=new HashSet<string>();var areas=Get(model,"Areas");AddCatalog(Get(areas,"FarmSize"),"SumArea","Farm","Areas.FarmSize",seen);AddCatalog(areas,"CultivatedArea","FarmArea","Areas",seen);
   foreach(DictionaryEntry pair in (IDictionary)Get(areas,"RotationSize"))AddCatalog(pair.Value,"SumArea",Text(Get(pair.Value,"Name")),"Areas.RotationSize",seen);
   foreach(var name in new string[]{"Labour","OmBalancePerHa","Pesticides","Energy","GHGs","Nutrition","Budget","EconResults","WaterUse","BeddingUse"}){var value=Get(model,name);if(value!=null)AddCatalog(value,value.GetType().Name,Text(Get(value,"Name")),name,seen);}
   foreach(var name in new string[]{"NutrientFlowsPerHa","Labour"}){var parent=Get(model,name);foreach(var p in parent.GetType().GetProperties(Flags)){if(p.PropertyType.Name=="sNPK"||p.PropertyType.Name=="sLabour")AddCatalog(p.GetValue(parent,null),p.PropertyType.Name,(name=="Labour"?"LabourBalance.":"NutrientFlow.")+p.Name,name+"."+p.Name,seen);}}
   var feeds=(IList)Get(model,"FeedBalances");if(feeds.Count>0)AddCatalog(feeds[0],"FeedBalance","FeedBalance","FeedBalances.0",seen);
   foreach(var feed in feeds)foreach(var p in feed.GetType().GetProperties(Flags))if(p.PropertyType.Name=="sFeed")AddCatalog(p.GetValue(feed,null),"sFeed",Text(Get(feed,"Name"))+"."+p.Name,"FeedBalances."+Get(feed,"Name")+"."+p.Name,seen);
   AddCatalog(Get(Get(model,"FeedSelfSupply"),"SelfSupplyTotal"),"sFeed","SelfSupply","FeedSelfSupply.SelfSupplyTotal",seen);
   var nutrition=Get(model,"Nutrition");foreach(var p in nutrition.GetType().GetProperties(Flags)){
    if(p.PropertyType.Name=="sBalance"||p.PropertyType.Name=="sNutrientYield")AddCatalog(p.GetValue(nutrition,null),p.PropertyType.Name,p.Name,"Nutrition."+p.Name,seen);
    if(p.Name=="FoodGroupDeviations"||p.Name=="NutrientDeviations"||p.Name=="NutrientYields")foreach(DictionaryEntry pair in (IDictionary)p.GetValue(nutrition,null))AddCatalog(pair.Value,pair.Value.GetType().Name,Text(pair.Key),"Nutrition."+p.Name+"."+pair.Key,seen);
   }
   foreach(DictionaryEntry pair in (IDictionary)Get(Get(model,"Manures"),"ManureUses"))AddCatalog(pair.Value,"ManureUse",Text(Get(pair.Value,"Name")),"Manures.ManureUses",seen);
  }
  object ConvertValue(object value,int depth,HashSet<object> visiting){
   if(value==null)return null;if(depth>12)return new Dictionary<string,object>{{"status","depth-limit"},{"type",value.GetType().FullName}};
   var type=value.GetType();if(value is double||value is float){double n=Number(value);return Double.IsNaN(n)||Double.IsInfinity(n)?(object)new Dictionary<string,object>{{"status","non-finite"},{"value",Text(value)}}:n;}
   if(value is string||value is bool||type.IsPrimitive||value is decimal)return value;if(type.IsEnum)return value.ToString();
   if(visiting.Contains(value))return new Dictionary<string,object>{{"status","reference"}};
   visiting.Add(value);try{
    if(value is IDictionary){var d=new Dictionary<string,object>();foreach(DictionaryEntry pair in (IDictionary)value)d[Text(pair.Key)]=ConvertValue(pair.Value,depth+1,visiting);return d;}
    if(value is IEnumerable){var list=new List<object>();foreach(var item in (IEnumerable)value)list.Add(ConvertValue(item,depth+1,visiting));return list;}
    var obj=new Dictionary<string,object>();foreach(var property in type.GetProperties(Flags)){if(property.GetIndexParameters().Length!=0||property.GetGetMethod(true)==null||property.GetGetMethod(true).IsStatic)continue;try{obj[property.Name]=ConvertValue(property.GetValue(value,null),depth+1,visiting);}catch(Exception e){obj[property.Name]=new Dictionary<string,object>{{"status","read-error"},{"error",e.Message}};}}
    foreach(var field in type.GetFields(BindingFlags.Public|BindingFlags.Instance))if(!obj.ContainsKey(field.Name))obj[field.Name]=ConvertValue(field.GetValue(value),depth+1,visiting);
    return obj;
   }finally{visiting.Remove(value);}
  }
  void Flatten(object value,string path,List<object> metrics){
   var dict=value as Dictionary<string,object>;if(dict!=null){foreach(var pair in dict)Flatten(pair.Value,path.Length==0?pair.Key:path+"."+pair.Key,metrics);return;}
   var list=value as IList;if(list!=null){for(int i=0;i<list.Count;i++)Flatten(list[i],path+"["+i+"]",metrics);return;}
   if(value is double||value is int||value is float||value is decimal||value is long){string leaf=path.Substring(path.LastIndexOf('.')+1);string[] description;string label=descriptions.TryGetValue(leaf,out description)?path.Substring(0,path.LastIndexOf('.')+1)+description[1]:path;metrics.Add(new Dictionary<string,object>{{"key",path},{"label",label},{"value",value},{"unit",Unit(path)}});}
  }
  string Unit(string path){var precise=ContextUnit(path);if(precise!=null)return precise;string currency=Text(Get(Get(farm,"EconData"),"Currency"));if(path=="Budget.HouseholdSize")return "persons";if(path=="Budget.ProportionFoodCosts")return "ratio";if(path.StartsWith("Budget."))return currency+"/year";if(path=="EconResults.ReturnToLabour")return currency+"/h";if(path.StartsWith("EconResults.")&&path.IndexOf('.',12)<0)return path.Contains("PerHa")?currency+"/ha/year":currency+"/year";if(path.StartsWith("OmBalance"))return path.StartsWith("OmBalancePerHa")?"kg OM/ha/year":"kg OM/year";if(path.StartsWith("WaterUse."))return path.Contains("PerHa")?"m3/ha/year":"m3/year";if(path.StartsWith("GHGs.TotalEmissionCO2eq"))return path.Contains("PerHa")?"t CO2eq/ha/year":"t CO2eq/year";if(path.StartsWith("GHGs.")&&path.EndsWith("CO2eq"))return "kg CO2eq/year";if(path.StartsWith("GHGs.")&&path.EndsWith("CH4"))return "kg CH4/year";if(path.StartsWith("GHGs.")&&path.EndsWith("N2O"))return "kg N2O/year";return "";}
  public string Evaluate(bool scoreOnly){
   var results=new Dictionary<string,object>();foreach(var name in modules){try{results[name]=ConvertValue(Get(model,name),0,new HashSet<object>());}catch(Exception e){results[name]=new Dictionary<string,object>{{"status","unavailable"},{"error",e.Message}};}}
   var metrics=new List<object>();Flatten(results,"",metrics);var violations=new List<object>();var constraintValues=new List<object>();var warnings=new List<object>();
   foreach(var descriptor in catalog){try{var pointer=ResolvePointer(Pointer("FindOutcomeVariableInModel",Text(descriptor["EntityType"]),Text(descriptor["ObjName"]),Text(descriptor["Variable"])));double value=Number(((PropertyInfo)pointer[1]).GetValue(pointer[0],null));metrics.Add(new Dictionary<string,object>{{"key",descriptor["key"]},{"label",CatalogLabel(descriptor)},{"value",Double.IsNaN(value)||Double.IsInfinity(value)?(object)null:value},{"status",Double.IsNaN(value)||Double.IsInfinity(value)?"undefined":"finite"},{"unit",NativeUnit(descriptor)},{"native",true},{"source",descriptor["source"]}});}catch(Exception e){warnings.Add("Native outcome unavailable: "+descriptor["key"]+" "+e.Message);}}
   Dictionary<string,object> config=document.ContainsKey("optimization")?Dict(document["optimization"]):new Dictionary<string,object>();
   foreach(var raw in config.ContainsKey("indicators")?ArrayOf(config["indicators"]):new object[0]){
    var indicator=Dict(raw);var key=Text(indicator["EntityType"])+":"+Text(indicator["ObjName"])+":"+Text(indicator["Variable"]);
    try {double value=Number(NativeOutcome(indicator));double min=Number(indicator["Minimum"]),max=Number(indicator["Maximum"]);bool constrained=indicator.ContainsKey("Constrain")&&Convert.ToBoolean(indicator["Constrain"]);var item=new Dictionary<string,object>{{"key",key},{"label",indicator["Description"]},{"value",Double.IsNaN(value)||Double.IsInfinity(value)?(object)null:value},{"unit","native"},{"minimum",min},{"maximum",max},{"enabled",constrained}};constraintValues.Add(item);if(constrained&&(Double.IsNaN(value)||Double.IsInfinity(value)||value<min-1e-7||value>max+1e-7))violations.Add(item);
    }catch(Exception e){bool constrained=indicator.ContainsKey("Constrain")&&Convert.ToBoolean(indicator["Constrain"]);if(constrained)violations.Add(new Dictionary<string,object>{{"key",key},{"label",indicator["Description"]},{"value",null},{"minimum",indicator["Minimum"]},{"maximum",indicator["Maximum"]},{"error",e.Message}});else warnings.Add("Unresolved native indicator: "+key+" "+e.Message);}
   }
   var output=new Dictionary<string,object>{{"engine","FarmDESIGN"},{"engineVersion",exe.GetName().Version.ToString()},{"farmId",document["farmId"]},{"modules",scoreOnly?(object)new Dictionary<string,object>():results},{"metrics",metrics},{"violations",violations},{"constraints",constraintValues},{"warnings",warnings}};
   return json.Serialize(output);
  }
  string CatalogLabel(Dictionary<string,object> d){string[] record;string variable=Text(d["Variable"]);return Text(d["ObjName"])+" · "+(descriptions.TryGetValue(variable,out record)?record[1]:variable);}
  string NutritionUnit(string nutrient,string variable){
   if(variable=="SelfSupply"||variable=="Deviation")return "%";
   if(variable.Contains("NSY")||variable.Contains("NutrientYield"))return "persons";
   if(nutrient.Contains("DietaryEnergy")||nutrient.Contains("Dietary energy"))return "kcal/year";
   if(nutrient.Contains("Protein")||nutrient.Contains("Carbohydrate")||nutrient.Contains("Fat")||nutrient.Contains("Fiber")||nutrient.Contains("Potassium"))return "g/year";
   if(nutrient.Contains("VitaminA")||nutrient.Contains("Vitamin A")||nutrient.Contains("VitaminB12")||nutrient.Contains("Vitamin B12")||nutrient.Contains("Folate"))return "ug/year";
   return "native";
  }
  string ContextUnit(string path){
   if(path.StartsWith("NutrientFlows")&&(path.EndsWith(".C")||path.EndsWith(".N")||path.EndsWith(".P")||path.EndsWith(".K")||path.EndsWith(".DM")||path.EndsWith(".OM")))return path.Contains("Efficiency")?"%":(path.StartsWith("NutrientFlowsPerHa")?"kg/ha/year":"kg/year");
   if(path.StartsWith("WaterUse.")&&path.EndsWith("WaterBalance"))return "%";
   if(path.StartsWith("Energy.")&&path.EndsWith("CH4Produced"))return "m3 CH4 (STP)/year";
   if(path.StartsWith("Energy.")&&path.EndsWith("TotalEnergyProduced"))return "MJ/year";
   if(path.StartsWith("FeedBalances")){
    if(path.Contains(".Deviation."))return "%";
    if(path.EndsWith(".DMD"))return "fraction";
    if(path.EndsWith(".CP"))return "kg protein/period";
    if(path.EndsWith(".EDM"))return "kg DM/period";
    if(path.EndsWith(".TDN"))return Text(Get(farm,"EnergyUnit"))=="VEM"?"kVEM/period":"1000 "+Text(Get(farm,"EnergyUnit"))+"/period";
   }
   if(path.StartsWith("FeedSelfSupply.")&&(path.Contains("SelfSupplyBalances")||path.Contains("SelfSupplyTotal")))return "%";
   if(path.StartsWith("Nutrition.")&&(path.EndsWith(".SelfSupply")||path.EndsWith(".Deviation")))return "%";
   if(path.StartsWith("Nutrition.")&&path.Contains("FunctionalDiversity"))return "ratio";
   if(path.StartsWith("NutrientFlowMatrix.FlowMetrics[")){
    string element="element";int start=path.IndexOf('[')+1;int end=path.IndexOf(']');int index;if(Int32.TryParse(path.Substring(start,end-start),out index)&&index>=0&&index<4)element=new string[]{"C","N","P","K"}[index];
    string leaf=path.Substring(path.LastIndexOf('.')+1);
    if(leaf.StartsWith("Number"))return "count";
    if(leaf=="LinkDensity")return "links/compartment";
    if(leaf.StartsWith("AscCap")||leaf.Contains("APL")||leaf.Contains("CyclingIndex")||leaf=="Patten"||leaf.StartsWith("Realized")||leaf.StartsWith("Connectance")||leaf.StartsWith("ConstraintEfficiency")||leaf.StartsWith("Compartimentation"))return "ratio";
    if(leaf.StartsWith("Ascendency")||leaf.StartsWith("Overhead")||leaf.StartsWith("Capacity"))return "kg "+element+" * bits/year";
    if(leaf.StartsWith("TST")||leaf.Contains("Throughflow")||leaf.Contains("Throughput")||leaf.Contains("LinkWeight"))return "kg "+element+"/year";
    if(leaf.Contains("Uncert")||leaf.Contains("Information")||leaf.Contains("ConstraintInfo"))return "bits";
   }
   return null;
  }
  string NativeUnit(Dictionary<string,object> d){string entity=Text(d["EntityType"]),variable=Text(d["Variable"]);if(entity=="GreenHouseGases"&&variable.StartsWith("TotalEmissionCO2eq"))return variable.Contains("PerHa")?"t CO2eq/ha/year":"t CO2eq/year";if(entity=="sBalance"||entity=="sNutrientYield")return NutritionUnit(Text(d["ObjName"]),variable);if(entity=="HumanNutrition"&&variable.Contains("FunctionalDiversity"))return "ratio";if(entity=="sFeed"){string name=Text(d["ObjName"]);if(name.Contains("Deviation")||name.Contains("SelfSupply"))return "%";if(variable=="DMD")return "fraction";if(variable=="CP")return "kg protein/period";if(variable=="EDM")return "kg DM/period";if(variable=="TDN")return Text(Get(farm,"EnergyUnit"))=="VEM"?"kVEM/period":"1000 "+Text(Get(farm,"EnergyUnit"))+"/period";}if(entity=="EnergyFlow"&&variable=="CH4Produced")return "m3 CH4 (STP)/year";if(entity=="OrganicMatter")return "kg OM/ha/year";if(entity=="sNPK")return Text(d["ObjName"]).Contains("Efficiency")?"%":"kg element/ha/year";if(entity=="SumArea"||entity=="Area")return "ha";if(entity=="sFeed"&&Text(d["ObjName"]).Contains("Deviation"))return "%";if(entity=="LabourBalance"&&variable.Contains("Time"))return "h/year";if(entity=="HouseholdBudget")return variable=="HouseholdSize"?"persons":variable.Contains("Proportion")?"ratio":Text(Get(Get(farm,"EconData"),"Currency"))+"/year";if(entity=="IrrigationWater"&&variable=="WaterBalance")return "%";if(entity=="IrrigationWater")return variable.Contains("PerHa")?"m3/ha/year":"m3/year";return "native";}
  public string StartSearch(string text){
   searchConfig=Dict(json.DeserializeObject(text));var settings=Dict(searchConfig["settings"]);var config=Dict(document["optimization"]);var variables=new List<object>();int i=1;
   int nextVariable=0;foreach(var rawVariable in ArrayOf(config["variables"])){var row=Dict(rawVariable);if(row.ContainsKey("DvrID"))nextVariable=Math.Max(nextVariable,Convert.ToInt32(row["DvrID"]));}foreach(var value in ArrayOf(searchConfig["variables"])){var v=new Dictionary<string,object>(Dict(value));ResolvePointer(Pointer("FindDecisionVariableInModel",Text(v["EntityType"]),Convert.ToInt32(v["ObjID"]),Text(v["Variable"])));if(!v.ContainsKey("DvrID"))v["DvrID"]=++nextVariable; i++;v["CasID"]=document["farmId"];if(!v.ContainsKey("ExactUse"))v["ExactUse"]=false;if(!v.ContainsKey("ExactValue"))v["ExactValue"]=0.0;if(!v.ContainsKey("ExactDeviation"))v["ExactDeviation"]=0.0;variables.Add(v);}
   var outcomes=new Dictionary<string,Dictionary<string,object>>();foreach(var item in ArrayOf(config["indicators"])){var v=new Dictionary<string,object>(Dict(item));v["Objective"]=false;outcomes[Text(v["EntityType"])+":"+Text(v["ObjName"])+":"+Text(v["Variable"])]=v;}
   foreach(var raw in ArrayOf(searchConfig["objectives"])){var o=Dict(raw);var v=OutcomeRecord(Text(o["key"]),outcomes);v["Objective"]=true;v["Direction"]=Text(o["direction"])=="max"?1:-1;}
   foreach(var raw in ArrayOf(searchConfig["constraints"])){var c=Dict(raw);var v=OutcomeRecord(Text(c["key"]),outcomes);bool constrained=v.ContainsKey("Constrain")&&Convert.ToBoolean(v["Constrain"]);double min=c["min"]==null?-1e30:Number(c["min"]),max=c["max"]==null?1e30:Number(c["max"]);if(constrained&&v.ContainsKey("Minimum")&&v.ContainsKey("Maximum")){min=Math.Max(min,Number(v["Minimum"]));max=Math.Min(max,Number(v["Maximum"]));}if(min>max)throw new InvalidOperationException("Conflicting original constraint");v["Constrain"]=true;v["Minimum"]=min;v["Maximum"]=max;}
   var outcomeRows=new List<object>();i=1;int nextOutcome=0;foreach(var v in outcomes.Values)if(v.ContainsKey("OuvID"))nextOutcome=Math.Max(nextOutcome,Convert.ToInt32(v["OuvID"]));if(config.ContainsKey("referenceIndicators"))foreach(var rawReference in ArrayOf(config["referenceIndicators"]))nextOutcome=Math.Max(nextOutcome,Convert.ToInt32(Dict(rawReference)["OuvID"]));foreach(var v in outcomes.Values){if(!v.ContainsKey("OuvID"))v["OuvID"]=++nextOutcome;i++;v["CasID"]=document["farmId"];outcomeRows.Add(v);}
   var dep=new Dictionary<string,object>(Dict(config["settings"]));dep["ParID"]=1;dep["Amplitude"]=settings["F"];dep["Probability"]=settings["CR"];dep["MultiFactor"]=settings["population"];dep["Generations"]=settings["generations"];
   var changedHeuristics=new Dictionary<string,object>(Dict(document["optimization"]));changedHeuristics["variables"]=variables.ToArray();changedHeuristics["indicators"]=outcomeRows.ToArray();changedHeuristics["settings"]=dep;WriteHeuristics(changedHeuristics);
   var heur=Create(dal.GetType("DAL.Domain.Heuristics.EntityCollections.HeuristicsData"));Call(heur,"SelectByCase",(object)new object[]{document["farmId"]});optimization.GetType().GetProperty("HeurData",Flags).SetValue(optimization,heur,null);
   Call(optimization,"Init",model,null);var de=Assembly.LoadFrom(Path.Combine(binPath,"DE.dll"));Call(optimization,"SetUp",Enum.Parse(de.GetType("DE.eDERecombStrategy"),"Rand1Bin"),Enum.Parse(de.GetType("DE.eDESelectStrategy"),"ParetoRank"),binPath+Path.DirectorySeparatorChar);Call(optimization,"SetPopulation");return SearchState(false);
  }
  Dictionary<string,object> OutcomeRecord(string key,Dictionary<string,Dictionary<string,object>> outcomes){
   if(outcomes.ContainsKey(key))return outcomes[key];var descriptor=catalog.Find(d=>Text(d["key"])==key);if(descriptor==null)throw new InvalidOperationException("Not an original FarmDESIGN outcome: "+key);var result=new Dictionary<string,object>{{"EntityType",descriptor["EntityType"]},{"ObjName",descriptor["ObjName"]},{"Variable",descriptor["Variable"]},{"Description",key},{"Weight",0.0},{"Original",0.0},{"Objective",false},{"Direction",1},{"Constrain",false},{"Minimum",0.0},{"Maximum",0.0}};outcomes[key]=result;return result;
  }
  public string StepSearch(){bool more=Convert.ToBoolean(Call(optimization,"Run",1));var state=Dict(json.DeserializeObject(SearchState(false)));state["continue"]=more;return json.Serialize(state);}
  public string FinishSearch(){return SearchState(true);}
  string SearchState(bool detailed){
   int count=Convert.ToInt32(Call(optimization,"GetNumberOfSolutions"));var rank=(int[])Call(optimization,"GetRankingData");var rows=new List<object>();int feasible=0;
   if(detailed){for(int index=0;index<count;index++){
     Call(optimization,"DecisionVariablesToModel",index);Call(model,"Calc");bool valid=Convert.ToBoolean(Call(optimization,"CheckDecisionVariables"))&&Convert.ToBoolean(Call(optimization,"CheckObjectives"))&&Convert.ToBoolean(Call(optimization,"CheckConstraints"));if(!valid)continue;
     var values=new List<object>();foreach(DictionaryEntry pair in (IDictionary)Get(optimization,"DecisionVariables")){var data=Get(pair.Value,"Data");var pointer=ResolvePointer(Get(pair.Value,"Pointer"));values.Add(new Dictionary<string,object>{{"EntityType",Get(data,"EntityType")},{"ObjID",Get(data,"ObjID")},{"Variable",Get(data,"Variable")},{"value",((PropertyInfo)pointer[1]).GetValue(pointer[0],null)}});}
     var scores=new Dictionary<string,object>();foreach(var o in ArrayOf(searchConfig["objectives"])){string key=Text(Dict(o)["key"]);var d=catalog.Find(item=>Text(item["key"])==key);double value=Number(NativeOutcome(d));if(Double.IsNaN(value)||Double.IsInfinity(value)){valid=false;break;}scores[key]=value;}
     if(valid){feasible++;rows.Add(new Dictionary<string,object>{{"id","FD-"+(index+1)},{"nativeIndex",index},{"nativeRank",rank[index]},{"values",values},{"scores",scores}});}
   }}
   return json.Serialize(new Dictionary<string,object>{{"population",count},{"iteration",Get(optimization,"IterationCount")},{"feasible",feasible},{"candidates",rows},{"native",true}});
  }
  public string ExportXml(){
   var name=Text(Get(farm,"Name"));if(name.IndexOfAny(Path.GetInvalidFileNameChars())>=0||name=="."||name=="..")throw new InvalidOperationException("Use a farm name without filename separators before native XML export");
   var exportFolder=Path.Combine(session,"Output",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(exportFolder);var exportDirectory=Create(dal.GetType("DAL.General.DirectoryHolder"),exportFolder+Path.DirectorySeparatorChar);
   var writer=Create(exe.GetType("Design.Output.Writers.FarmDataTxtWriter"),exportDirectory);var heuristics=Get(optimization,"HeurData");
   string path=Text(Call(writer,"WriteXML",farm,heuristics));if(!File.Exists(path))throw new InvalidOperationException("Native XML output was not created: "+path);
   if(!Path.GetFullPath(path).StartsWith(Path.GetFullPath(Path.Combine(session,"Output"))+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Unexpected native export path");
   return json.Serialize(new Dictionary<string,object>{{"xml",File.ReadAllText(path)}});
  }
  Dictionary<string,object> ReferenceData(string database){
   var result=new Dictionary<string,object>();var db=Path.Combine(Path.GetDirectoryName(binPath),"Input",database);var farmTables=new List<string>(tables);farmTables.AddRange(new[]{"NTE","PHO","VRS"});using(var conn=new OleDbConnection("Provider=Microsoft.Jet.OLEDB.4.0;Data Source="+db+";Mode=Read;")){conn.Open();foreach(var table in database=="FarmDB.mdb"?farmTables.ToArray():new string[]{"DEP","DVR","OUV","VAR","VRS"}){var data=new DataTable();using(var adapter=new OleDbDataAdapter("SELECT * FROM "+Quoted(table),conn))adapter.Fill(data);var rows=new List<object>();foreach(DataRow row in data.Rows){var record=new Dictionary<string,object>();foreach(DataColumn column in data.Columns)record[column.ColumnName]=row[column] is DBNull?null:row[column];rows.Add(record);}result[table]=rows.ToArray();}}return result;
  }
  void CollectXml(object obj,Dictionary<string,List<Dictionary<string,object>>> collected,HashSet<object> seen){
   if(obj==null||obj is string||obj.GetType().IsValueType||seen.Contains(obj))return;seen.Add(obj);
   if(obj is IDictionary){foreach(DictionaryEntry pair in (IDictionary)obj)CollectXml(pair.Value,collected,seen);return;}
   if(obj is IEnumerable){foreach(var value in (IEnumerable)obj)CollectXml(value,collected,seen);return;}
   var type=obj.GetType();if(!type.FullName.StartsWith("DAL.Domain."))return;
   var tableMethod=type.GetMethod("getTableName",Flags);if(tableMethod!=null){var table=Text(Call(obj,"getTableName"));if(System.Array.IndexOf(tables,table)>=0||table=="DVR"||table=="OUV"||table=="VAR"||table=="NTE"||table=="PHO"){
     var row=new Dictionary<string,object>();foreach(var p in type.GetProperties(Flags))foreach(var attribute in p.GetCustomAttributesData())if(attribute.AttributeType.Name=="MappingAttribute"&&attribute.ConstructorArguments.Count>0)row[Text(attribute.ConstructorArguments[0].Value)]=p.GetValue(obj,null);
     if(!collected.ContainsKey(table))collected[table]=new List<Dictionary<string,object>>();collected[table].Add(row);
   }}
   foreach(var p in type.GetProperties(Flags)){if(p.GetIndexParameters().Length!=0||p.PropertyType.IsValueType||p.PropertyType==typeof(string)||p.GetGetMethod(true)==null||p.GetGetMethod(true).IsStatic)continue;CollectXml(p.GetValue(obj,null),collected,seen);}
  }
  public string ImportXml(string text){
   if(text.StartsWith("\""))text=Text(json.DeserializeObject(text));
   var serializer=new XmlSerializer(exe.GetType("Design.Output.FarmData"));var settings=new XmlReaderSettings{DtdProcessing=DtdProcessing.Prohibit,XmlResolver=null,MaxCharactersInDocument=8*1024*1024};object imported;
   using(var reader=XmlReader.Create(new StringReader(text),settings))imported=serializer.Deserialize(reader);
   var importedFarm=Get(imported,"MixedFarmData");if(importedFarm==null)throw new InvalidOperationException("Native XML contains no farm");
   var collected=new Dictionary<string,List<Dictionary<string,object>>>();CollectXml(importedFarm,collected,new HashSet<object>());CollectXml(Get(imported,"DataHeuristics"),collected,new HashSet<object>());
   var reference=ReferenceData("FarmDB.mdb");var heuristicReference=ReferenceData("de.mdb");var inputTables=new Dictionary<string,object>();var legacy=new List<object>();
   foreach(var table in tables){if(table=="DRI"||table=="DRF"){inputTables[table]=reference[table];continue;}var rows=new List<object>();if(collected.ContainsKey(table))foreach(var extracted in collected[table]){
     var originals=ArrayOf(reference[table]);Dictionary<string,object> row=new Dictionary<string,object>(StringComparer.OrdinalIgnoreCase);string primary=null;foreach(var key in extracted.Keys)if(key.EndsWith("ID")&&key!="FrmID"){primary=key;break;}if(table=="FRM")primary="FrmID";
     foreach(var original in originals){var item=Dict(original);if(primary!=null&&extracted.ContainsKey(primary)&&item.ContainsKey(primary)&&Text(extracted[primary])==Text(item[primary])){row=new Dictionary<string,object>(item,StringComparer.OrdinalIgnoreCase);break;}}
     foreach(var pair in extracted)row[pair.Key]=pair.Value;
     // Unmapped legacy fields remain explicit reference values, never inferred observations.
     foreach(var key in row.Keys)if(!extracted.ContainsKey(key))legacy.Add(table+"."+key);
     rows.Add(row);
    }inputTables[table]=rows.ToArray();}
   var opt=new Dictionary<string,object>{{"displayVariables",collected.ContainsKey("VAR")?(object)collected["VAR"].ToArray():new object[0]},{"versionRecords",heuristicReference["VRS"]},{"variables",collected.ContainsKey("DVR")?(object)collected["DVR"].ToArray():new object[0]},{"indicators",collected.ContainsKey("OUV")?(object)collected["OUV"].ToArray():new object[0]},{"settings",ArrayOf(heuristicReference["DEP"])[0]}};
   // Native CLR attributes name the SQL constraint column explicitly.
   var auxiliary=new Dictionary<string,object>();foreach(var name in new string[]{"NTE","PHO"})auxiliary[name]=collected.ContainsKey(name)?(object)collected[name].ToArray():new object[0];
   var outputDoc=new Dictionary<string,object>{{"schema","FarmSystemDesign.FarmDESIGN.NativeTables"},{"schemaVersion",1},{"farmId",Get(importedFarm,"FrmID")},{"tables",inputTables},{"auxiliaryTables",auxiliary},{"optimization",opt},{"provenance",new Dictionary<string,object>{{"kind","native-xml-import"},{"referenceDatabase","Author Ditzler 2019 FarmDB.mdb"},{"referenceTables",new string[]{"DRI","DRF","DEP"}},{"legacyColumnsFromReference",legacy},{"nativeAssemblyVersion",Get(imported,"AssemblyVersion")}}},{"originalNativeXml",text}};
   return json.Serialize(new Dictionary<string,object>{{"document",outputDoc},{"referenceTablesRequired",new string[]{"DRI","DRF","DEP"}}});
  }
  void DisposeModel(){if(model!=null){try{Call(model,"Close");}catch{}model=null;farm=null;optimization=null;}}
  public void Dispose(){DisposeModel();try{var manager=dal.GetType("DAL.General.DBConnectionManager");var instance=manager.GetProperty("Instance",Flags).GetValue(null,null);Call(instance,"CloseAllConnections");}catch{}}
 }
}
