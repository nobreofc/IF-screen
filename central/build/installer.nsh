; IF Screen Central — regras do Firewall do Windows (modo "in loco")
; TCP 8787: celulares enviam dados à Central na mesma rede
; UDP 8788: descoberta automática da Central pelos celulares

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - dados (TCP 8787)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - descoberta (UDP 8788)"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central" dir=in action=allow program="$INSTDIR\IF Screen Central.exe" enable=yes profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central - dados (TCP 8787)" dir=in action=allow protocol=TCP localport=8787 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="IF Screen Central - descoberta (UDP 8788)" dir=in action=allow protocol=UDP localport=8788 profile=any'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - dados (TCP 8787)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="IF Screen Central - descoberta (UDP 8788)"'
!macroend
