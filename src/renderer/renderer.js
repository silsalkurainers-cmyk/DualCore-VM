const message = document.getElementById("message");

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = error ? "message error" : "message";
}

async function refresh() {
  try {
    const state = await window.dualcore.getStatus();
    document.getElementById("host-status").textContent =
      state.qemuFound && state.qemuImgFound ? "QEMU READY" : "QEMU NOT FOUND";
    const warning = document.getElementById("dependency-warning");
    if (!state.qemuFound || !state.qemuImgFound) {
      warning.hidden = false;
      warning.textContent = "QEMU or qemu-img is missing. Install QEMU for Windows, add its installation folder to PATH, then restart this app.";
    } else {
      warning.hidden = true;
    }
    for (const [id, vm] of Object.entries(state.vms)) {
      document.getElementById(id + "-iso").textContent =
        "Installer ISO: " + (vm.isoPath ? vm.isoPath.split(/[\\/]/).pop() : "not selected");
      document.getElementById(id + "-disk").textContent =
        "Virtual disk: " + (vm.diskPath ? vm.diskPath.split(/[\\/]/).pop() : "not created");
      document.getElementById(id + "-status").textContent = vm.running ? "RUNNING" : "STOPPED";
      const card = document.querySelector('[data-vm="' + id + '"]');
      card.classList.toggle("running", vm.running);
      card.querySelector('[data-action="start"]').disabled = vm.running;
      card.querySelector('[data-action="stop"]').disabled = !vm.running;
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

document.querySelectorAll(".vm-card button").forEach(button => {
  button.addEventListener("click", async () => {
    const card = button.closest(".vm-card");
    const id = card.dataset.vm;
    const action = button.dataset.action;
    button.disabled = true;
    try {
      if (action === "iso") await window.dualcore.chooseIso(id);
      if (action === "disk") await window.dualcore.createDisk(id);
      if (action === "start") await window.dualcore.startVm(id);
      if (action === "stop") await window.dualcore.stopVm(id);
      showMessage(action === "start" ? "VM launch requested." : action === "stop" ? "VM stopped." : "VM settings updated.");
      await refresh();
    } catch (error) {
      showMessage(error.message || String(error), true);
      await refresh();
    } finally {
      button.disabled = false;
    }
  });
});

refresh();
