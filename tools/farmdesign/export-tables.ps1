param([Parameter(Mandatory=$true)][string]$Database,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$connection=$null
foreach($provider in @('Microsoft.ACE.OLEDB.16.0','Microsoft.ACE.OLEDB.12.0','Microsoft.Jet.OLEDB.4.0')) {
    try { $connection=New-Object System.Data.OleDb.OleDbConnection("Provider=$provider;Data Source=$Database;Mode=Read;"); $connection.Open(); break } catch { if($connection){$connection.Dispose()}; $connection=$null }
}
if(-not $connection){throw 'Cannot open the author database with a read-only local OLE DB provider.'}
try {
    $tables=@{}
    foreach($item in $connection.GetSchema('Tables').Rows){
        $name=[string]$item.TABLE_NAME
        if($item.TABLE_TYPE -ne 'TABLE' -or $name -notmatch '^[A-Z]{3}$'){continue}
        $table=New-Object System.Data.DataTable
        $adapter=New-Object System.Data.OleDb.OleDbDataAdapter("SELECT * FROM [$name]",$connection)
        [void]$adapter.Fill($table)
        $rows=@(foreach($row in $table.Rows){$obj=[ordered]@{}; foreach($column in $table.Columns){$value=$row[$column.ColumnName]; $obj[$column.ColumnName]=if($value -is [DBNull]){$null}else{$value}}; [pscustomobject]$obj})
        $columns=@(foreach($column in $table.Columns){@{name=$column.ColumnName;type=$column.DataType.FullName}})
        $tables[$name]=@{columns=$columns;rows=$rows}
        $adapter.Dispose();$table.Dispose()
    }
    [IO.File]::WriteAllText($Destination,($tables | ConvertTo-Json -Depth 30),(New-Object Text.UTF8Encoding($false)))
} finally { $connection.Close();$connection.Dispose() }
