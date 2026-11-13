param([Parameter(Mandatory=$true)][string]$Runtime,[Parameter(Mandatory=$true)][string]$Session,[ValidateSet('None','Simple','Complex')][string]$NetworkMode='Simple')
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$nativeHost=$null
try {
    $bin=Join-Path $Runtime 'Bin'
    Set-Location -LiteralPath $bin
    [Environment]::CurrentDirectory=$bin
    Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Data,System.Xml,System.Web.Extensions
    # The native desktop modules resolve images relative to Application.StartupPath.
    # Adapt only this isolated process; never copy resources into a Windows folder.
    $startup=[System.Windows.Forms.Application].GetField('startupPath',[Reflection.BindingFlags]'Static,NonPublic')
    if($startup){$startup.SetValue($null,$bin)}
    $dal=[Reflection.Assembly]::LoadFrom((Join-Path $bin 'DAL.dll'))
    $exe=[Reflection.Assembly]::LoadFrom((Join-Path $bin 'FarmDESIGN.exe'))
    [xml]$config=Get-Content -LiteralPath (Join-Path $bin 'applConfig.FarmDESIGN.ini') -Raw
    foreach($oldNetwork in @($config.SelectNodes('/init/element[name="NetworkMetrics"]'))){[void]$config.DocumentElement.RemoveChild($oldNetwork)}
    $network=$config.CreateElement('element')
    $networkName=$config.CreateElement('name');$networkName.InnerText='NetworkMetrics';[void]$network.AppendChild($networkName)
    $networkValue=$config.CreateElement('value');$networkValue.InnerText=if($NetworkMode -eq 'None'){''}else{$NetworkMode};[void]$network.AppendChild($networkValue)
    if($NetworkMode -ne 'None'){[void]$config.DocumentElement.AppendChild($network)}
    foreach($element in $config.init.element){
        if($element.name -eq 'InputDirectoryPath'){$element.SelectSingleNode('value').InnerText=(Join-Path $Session 'Input')+'\'}
        if($element.name -eq 'OutputDirectoryPath'){$element.SelectSingleNode('value').InnerText=(Join-Path $Session 'Output')+'\'}
    }
    $flags=[Reflection.BindingFlags]'Public,NonPublic,Instance,Static'
    $applType=$dal.GetType('DAL.General.Init.ApplInit')
    $ctor=$applType.GetConstructor($flags,$null,[type[]]@([System.Xml.XmlNodeList]),$null)
    $initArgs=New-Object object[] 1
    $initArgs[0]=$config.DocumentElement.SelectNodes('element')
    $appl=$ctor.Invoke($initArgs)
    $applType.GetField('_instance',$flags).SetValue($null,$appl)
    $applType.GetField('parentAppName',$flags).SetValue($null,'FarmDESIGN')
    $hostSource=Join-Path $PSScriptRoot 'NativeHost.cs'
    Add-Type -Path $hostSource -ReferencedAssemblies 'System.Data','System.Xml','System.Core','System.Web.Extensions'
    $nativeHost=New-Object FarmSystemNative.Host($bin,$Session)
    [Console]::WriteLine('@@FARMDESIGN@@{"ready":true,"engineVersion":"4.21.5.0"}')
    while($null -ne ($line=[Console]::ReadLine())){
        try {
            $command=$line | ConvertFrom-Json
            if($command.action -eq 'quit'){break}
            $result=switch($command.action){
                'load' { $nativeHost.Load([string]$command.json) }
                'stage-gui' { $nativeHost.StageGui([string]$command.json) }
                'variables' { $nativeHost.Variables([string]$command.json) }
                'evaluate' { $nativeHost.Evaluate($false) }
                'export-xml' { $nativeHost.ExportXml() }
                'import-xml' { $nativeHost.ImportXml([string]$command.json) }
                'start-search' { $nativeHost.StartSearch([string]$command.json) }
                'step-search' { $nativeHost.StepSearch() }
                'finish-search' { $nativeHost.FinishSearch() }
                default { throw 'Unknown local engine command' }
            }
            [Console]::WriteLine('@@FARMDESIGN@@{"ok":true,"result":'+$result+'}')
        } catch {
            $errorText=$_.Exception.ToString()
            [Console]::WriteLine('@@FARMDESIGN@@'+(@{ok=$false;error=$errorText} | ConvertTo-Json -Compress))
        }
    }
} catch {
    [Console]::WriteLine('@@FARMDESIGN@@'+(@{ready=$false;error=$_.Exception.ToString()} | ConvertTo-Json -Compress))
} finally {if($nativeHost){$nativeHost.Dispose()}}
