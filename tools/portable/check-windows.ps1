param([Parameter(Mandatory=$true)][string]$Database)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
try {
    $release=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full').Release
    if($release -lt 528040){throw '.NET Framework 4.8 or later is required.'}
    Add-Type -AssemblyName System.Data
    $builder=New-Object System.Data.OleDb.OleDbConnectionStringBuilder
    $builder.Provider='Microsoft.Jet.OLEDB.4.0'
    $builder['Data Source']=$Database
    $builder['Mode']='Read'
    $connection=New-Object System.Data.OleDb.OleDbConnection($builder.ConnectionString)
    try {
        $connection.Open()
        $command=$connection.CreateCommand();$command.CommandText='SELECT COUNT(*) FROM FRM'
        $rows=$command.ExecuteScalar()
    } finally {$connection.Dispose()}
    foreach($component in @('ADODB.Connection','JRO.JetEngine')){
        $instance=New-Object -ComObject $component
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($instance)
    }
    @{frameworkRelease=$release;processBits=([IntPtr]::Size*8);databaseProvider='Microsoft.Jet.OLEDB.4.0';farmRows=$rows;originalUiComponents='ADO and JRO available';officeRequired=$false} | ConvertTo-Json -Compress
} catch {
    [Console]::WriteLine($_.Exception.Message)
    exit 1
}
