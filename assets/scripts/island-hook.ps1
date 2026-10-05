param([string]$Executable,[string]$Runner,[string]$Config,[string]$Event,[string]$Source)
$env:ELECTRON_RUN_AS_NODE='1'
& $Executable $Runner $Config $Event $Source '--feimo-hook'
exit $LASTEXITCODE
