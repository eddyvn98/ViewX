#define AppName "Vivutrade Pro Installer"
#define AppVersion "1.0.0"
#define AppPublisher "VivuTrade"
#define AppExeName "CLICK-TO-INSTALL-VIVUTRADE-PRO.bat"
#ifndef InstallMode
  #define InstallMode "desktop-full"
#endif
#ifndef ExtensionId
  #define ExtensionId "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
#endif
#ifndef ExtensionUpdateUrl
  #define ExtensionUpdateUrl "http://localhost:3000/downloads/chrome-extension/update.xml"
#endif
#ifndef AccessToken
  #define AccessToken ""
#endif
#ifndef NodeWsUrl
  #define NodeWsUrl "ws://127.0.0.1:8091"
#endif

#ifndef RepoRoot
  #define RepoRoot "."
#endif
#ifndef PayloadDir
  #define PayloadDir RepoRoot + "\public\downloads\installer"
#endif
#ifndef OutputDir
  #define OutputDir RepoRoot + "\public\downloads"
#endif

[Setup]
AppId={{A8A771C5-A2DD-4D26-A740-1A95F0B9B101}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\VivutradeProInstaller
DefaultGroupName=VivuTrade
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=Vivutrade-Desktop-Full-Installer
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UsePreviousAppDir=no
Uninstallable=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.bak,__pycache__\*"

[Icons]
Name: "{autoprograms}\Vivutrade Pro Installer"; Filename: "{cmd}"; Parameters: "/c ""{app}\{#AppExeName}"""; WorkingDir: "{app}"
Name: "{autoprograms}\Vivutrade Desktop"; Filename: "{localappdata}\VivutradePro\bin\Start-Vivutrade-Desktop.cmd"; WorkingDir: "{localappdata}\VivutradePro\bin"
Name: "{autodesktop}\Vivutrade Desktop"; Filename: "{localappdata}\VivutradePro\bin\Start-Vivutrade-Desktop.cmd"; WorkingDir: "{localappdata}\VivutradePro\bin"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\_internal\setup-pro-local.ps1"" -Browser chrome -InstallMode {#InstallMode} -ExtensionId ""{#ExtensionId}"" -ExtensionUpdateUrl ""{#ExtensionUpdateUrl}"" -AccessToken ""{#AccessToken}"" -NodeWsUrl ""{#NodeWsUrl}"""; \
  Flags: runhidden waituntilterminated
