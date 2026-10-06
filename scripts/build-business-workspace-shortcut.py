"""Build the explicitly requested G-drive folder shortcut on its verified PC.

Build-only dependency: pylnk3==0.4.3. No desktop or Drive content is modified.
"""

from datetime import datetime
from hashlib import sha256
from importlib.metadata import version
from pathlib import Path
import os
import subprocess
import sys

import pylnk3


TARGET = r"G:\.shortcut-targets-by-id\1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ" + "\\D-CATS\u696d\u52d9\u9023\u643a"
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "integrations" / "dcats-business-workspace.lnk"


def main():
    if sys.platform != "win32" or not Path(TARGET).is_dir():
        raise RuntimeError("Generate only on the PC with the verified shared folder mounted.")
    if version("pylnk3") != "0.4.3":
        raise RuntimeError("The shortcut builder requires pylnk3==0.4.3.")

    link = pylnk3.for_file(TARGET, work_dir=TARGET)
    link.description = "D-CATS business-exchange shared folder (Google Drive G:)"
    link.file_flags.directory = True
    link.link_flags.ForceNoLinkInfo = True
    link.link_flags.ForceNoLinkTrack = True
    link.link_flags.DisableLinkPathTracking = True
    link.link_flags.DisableKnownFolderTracking = True
    link.link_flags.DisableKnownFolderAlias = True
    stamp = datetime(2000, 1, 1)
    link.creation_time = link.access_time = link.modification_time = stamp
    for item in link.shell_item_id_list.items:
        if isinstance(item, pylnk3.PathSegmentEntry):
            item.created = item.modified = item.accessed = stamp
            item.file_size = 0
    link.extra_data = pylnk3.ExtraData(blocks=[])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    link.save(str(OUTPUT))

    checked = pylnk3.parse(str(OUTPUT))
    if checked.work_dir != TARGET or checked.arguments:
        raise RuntimeError("Generated folder target or arguments differ.")
    if checked.extra_data.blocks or not checked.file_flags.directory:
        raise RuntimeError("Tracking or non-folder data must not be distributed.")
    # The library omits Unicode-only PIDL segments on readback; verify with Windows.
    verify = r"""
$shell = New-Object -ComObject WScript.Shell
try {
  $shortcut = $shell.CreateShortcut($env:DCATS_SHORTCUT_OUTPUT)
  if ($shortcut.TargetPath -cne $env:DCATS_SHORTCUT_TARGET -or
      $shortcut.WorkingDirectory -cne $env:DCATS_SHORTCUT_TARGET -or
      $shortcut.Arguments -or
      !(Test-Path -LiteralPath $shortcut.TargetPath -PathType Container)) {
    throw 'Windows shortcut readback does not match the verified folder.'
  }
} finally {
  if ($shortcut) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut) }
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
"""
    subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", verify],
        check=True,
        capture_output=True,
        env={**os.environ, "DCATS_SHORTCUT_OUTPUT": str(OUTPUT), "DCATS_SHORTCUT_TARGET": TARGET},
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    print(f"Folder shortcut: {OUTPUT.name}; bytes={OUTPUT.stat().st_size}; sha256={sha256(OUTPUT.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
