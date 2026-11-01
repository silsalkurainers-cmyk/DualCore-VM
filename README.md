# DualCore VM

DualCore VM is a portable Electron front end for QEMU. The current release targets **64-bit Windows 10 and Windows 11 hosts** and manages two independent guests:

- Windows 11
- Arch Linux, with KDE Plasma installed inside the guest after the base system

## Requirements

- 64-bit Windows 10 or Windows 11.
- 64-bit QEMU for Windows, including both `qemu-system-x86_64.exe` and `qemu-img.exe`.
- Add the QEMU installation directory to the Windows `PATH`, then restart DualCore VM.
- An installer ISO for each guest.
- Hardware virtualization enabled in the PC firmware. QEMU uses the Windows Hypervisor Platform accelerator (`whpx`).

## Use

1. Open DualCore VM.
2. Choose an installer ISO for the guest.
3. Choose **Create disk** and save a new `.qcow2` virtual disk. Windows gets an 80 GB virtual disk by default; Arch gets 50 GB. These are virtual disk capacities, not preallocated host partitions.
4. Start the VM and install the guest into its own virtual disk.
5. Stop the VM from the dashboard when finished.

The VM configuration is stored in the app's Electron user-data folder. ISO and disk files remain wherever you choose to save them.

## Important limitations in this initial QEMU launcher

- The Windows 11 guest path still needs UEFI firmware and a TPM 2.0 device configured before Windows 11 installation. The current launcher does **not** configure those devices yet; do not attempt the Windows 11 install with this version.
- The Arch guest starts from its ISO. KDE Plasma is not preinstalled; install Arch first, then install and enable the Plasma desktop in the guest.
- QEMU must be installed separately. It is not bundled into the portable executable.
- The launcher currently targets Windows hosts only. Linux-host support is not included in this release.

## Build

```powershell
npm install
npm start
npm run build
```

The build produces a Windows portable executable under `dist/`.
