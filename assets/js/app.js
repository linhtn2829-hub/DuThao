const cloneData = (value) => JSON.parse(JSON.stringify(value));

const state = cloneData(window.GENCO_INITIAL_STATE);
const orgUsers = cloneData(window.GENCO_ORG_USERS);
const fileRules = cloneData(window.GENCO_FILE_RULES);
const detailDocuments = cloneData(window.GENCO_DETAIL_DOCUMENTS);
detailDocuments.completedDraftFiles = detailDocuments.completedDraftFiles || [];

const signingFiles = {
  main: []
};

const signDetailDemoFiles = [
  {
    name: "Du_thao_quy_trinh_gop_y_cac_Ban_VP_hoan_thien.docx",
    size: 1180 * 1024,
    role: "main"
  },
  {
    name: "Bang_tong_hop_y_kien_gop_y_du_thao.xlsx",
    size: 486 * 1024,
    role: "attachment"
  },
  {
    name: "Can_cu_phap_ly_va_quy_dinh_lien_quan.pdf",
    size: 1320 * 1024,
    role: "attachment"
  }
];

const appLayout = document.getElementById("appLayout");

let pendingConfirmAction = null;
let completedDraftUploadFiles = [];
let signCreateMode = "create";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.getElementById("toastArea").appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function openConfirmModal({
  title,
  message,
  primaryText,
  secondaryText,
  primaryVariant = "primary",
  onConfirm
}) {
  pendingConfirmAction = onConfirm;

  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalMessage").textContent = message;
  document.getElementById("confirmModalPrimary").textContent = primaryText;
  document.getElementById("confirmModalSecondary").textContent =
    secondaryText;

  document.getElementById("confirmModalPrimary").className =
    `genco-button genco-button--${primaryVariant}`;

  document.getElementById("confirmModal").classList.add("open");
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  document.getElementById("confirmModal").classList.remove("open");
}

function hasUnsavedData() {
  return Boolean(
    document.getElementById("title").value.trim() ||
      document.getElementById("dueDate").value ||
      document.getElementById("note").value.trim() ||
      state.draftFiles.length ||
      state.attachmentFiles.length ||
      state.commenters.length ||
      state.ccUsers.length
  );
}

function initials(name) {
  const parts = name.trim().split(/\s+/);

  return parts.length > 1
    ? `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function materialIcon(name) {
  return `
    <span class="genco-button__icon material-symbols-outlined" aria-hidden="true">
      ${escapeHtml(name)}
    </span>
  `;
}

const workflowMenuItems = [
  {
    key: "create",
    label: "Tạo hồ sơ",
    icon: "note_add",
    title: "Tạo mới hồ sơ dự thảo"
  },
  {
    key: "all",
    label: "Tất cả hồ sơ",
    icon: "folder_open",
    title: "Xem danh sách hồ sơ dự thảo"
  },
  {
    key: "signing",
    label: "Trình ký",
    icon: "stylus_note",
    title: "Xem các trình ký cần ký của bản thân",
    badge: "6"
  }
];

function workflowMenuMarkup(activeKey) {
  return `
    <div class="workflow-brand">
      <div class="brand-orbit">✦</div>
      <div>
        <div class="workflow-brand-title">Genco3 Workflow</div>
        <div class="workflow-brand-subtitle">Quản lý quy trình</div>
      </div>
      <button
        class="brand-collapse workflow-menu-collapse-toggle"
        type="button"
        data-toggle-inbox-menu
        title="Thu gọn menu"
        aria-label="Thu gọn menu"
        aria-expanded="true"
      >
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
    </div>

    <nav class="workflow-nav" aria-label="Điều hướng quy trình">
      ${workflowMenuItems
        .map(
          (item) => `
            <button
              class="workflow-nav-item ${item.key === activeKey ? "active" : ""}"
              type="button"
              data-workflow-menu-action="${item.key}"
              title="${escapeHtml(item.title)}"
              ${item.key === activeKey ? 'aria-current="page"' : ""}
            >
              <span class="material-symbols-outlined">${item.icon}</span>
              ${item.label}
              ${
                item.badge
                  ? `<span class="nav-badge blue">${item.badge}</span>`
                  : ""
              }
            </button>
          `
        )
        .join("")}
    </nav>

    <div class="workflow-menu-footer">
      <div class="workflow-account">
        <span class="workflow-avatar"></span>
        <div>
          <div class="workflow-account-name">Lê Văn Danh</div>
          <div class="workflow-account-mail">Tổng Giám đốc</div>
        </div>
        <span class="material-symbols-outlined">more_vert</span>
      </div>
    </div>
  `;
}

function renderWorkflowMenus() {
  document.querySelectorAll("[data-workflow-menu]").forEach((menu) => {
    menu.innerHTML = workflowMenuMarkup(menu.dataset.activeMenu || "all");
  });
}

function setWorkflowMenuActive(screenId, activeKey) {
  const menu = document.querySelector(`#${screenId} [data-workflow-menu]`);

  if (!menu) return;

  menu.dataset.activeMenu = activeKey;
  menu.querySelectorAll("[data-workflow-menu-action]").forEach((item) => {
    const isActive = item.dataset.workflowMenuAction === activeKey;
    item.classList.toggle("active", isActive);

    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}

function syncSigningInboxColumnControls() {
  const screen = document.getElementById("signingInboxView");

  if (!screen) return;

  const menuCollapsed = screen.classList.contains("inbox-menu-collapsed");
  const listCollapsed = screen.classList.contains("inbox-list-collapsed");
  const detailCollapsed = screen.classList.contains("inbox-detail-collapsed");
  const menuToggle = screen.querySelector("[data-toggle-inbox-menu]");
  const listToggle = screen.querySelector("[data-toggle-inbox-list]");

  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", String(!menuCollapsed));
    menuToggle.setAttribute(
      "aria-label",
      menuCollapsed ? "Mở menu" : "Thu gọn menu"
    );
    menuToggle.title = menuCollapsed ? "Mở menu" : "Thu gọn menu";
    menuToggle.querySelector(".material-symbols-outlined").textContent =
      menuCollapsed ? "chevron_right" : "chevron_left";
  }

  if (listToggle) {
    listToggle.setAttribute("aria-expanded", String(!listCollapsed));
    listToggle.setAttribute(
      "aria-label",
      listCollapsed ? "Mở danh sách trình ký" : "Thu gọn danh sách trình ký"
    );
    listToggle.title = listCollapsed
      ? "Mở danh sách trình ký"
      : "Thu gọn danh sách trình ký";
    listToggle.querySelector(".material-symbols-outlined").textContent =
      listCollapsed ? "right_panel_open" : "left_panel_close";
  }

  screen.querySelectorAll("[data-toggle-inbox-detail]").forEach((toggle) => {
    toggle.setAttribute("aria-expanded", String(!detailCollapsed));
    toggle.setAttribute(
      "aria-label",
      detailCollapsed ? "Mở chi tiết trình ký" : "Thu gọn chi tiết trình ký"
    );
    toggle.title = detailCollapsed
      ? "Mở chi tiết trình ký"
      : "Thu gọn chi tiết trình ký";
  });
}

function toggleSigningInboxColumn(column) {
  const screen = document.getElementById("signingInboxView");

  if (!screen) return;

  if (column === "menu") {
    screen.classList.toggle("inbox-menu-collapsed");
  }

  if (column === "list") {
    const willCollapse = !screen.classList.contains("inbox-list-collapsed");

    screen.classList.toggle("inbox-list-collapsed", willCollapse);

    if (willCollapse) {
      screen.classList.remove("inbox-detail-collapsed");
    }
  }

  if (column === "detail") {
    const willCollapse = !screen.classList.contains("inbox-detail-collapsed");

    screen.classList.toggle("inbox-detail-collapsed", willCollapse);
    screen.classList.remove("workflow-detail-expanded");

    if (willCollapse) {
      screen.classList.remove("inbox-list-collapsed");
    }
  }

  syncSigningInboxColumnControls();
  requestAnimationFrame(drawSignHistorySegments);
}

let selectedPowerPersonFilter = "owner";
let signerActionModalMode = "";

function powerAppHeaderMarkup() {
  return `
    <div class="topbar-left">
      <span class="material-symbols-outlined power-app-launcher">apps</span>
      <span class="topbar-product">Power Apps</span>
      <span class="topbar-divider"></span>
      <span class="topbar-title">GenCo3 Work Flow</span>
      <span class="material-symbols-outlined topbar-info">info</span>
    </div>

    <div class="power-app-header-center">
      <label class="power-person-select">
        <span class="material-symbols-outlined">person</span>
        <select data-power-person-filter aria-label="Chọn nhóm người ký">
          <option value="owner" ${selectedPowerPersonFilter === "owner" ? "selected" : ""}>
            Chủ trì
          </option>
          <option value="department-pic" ${selectedPowerPersonFilter === "department-pic" ? "selected" : ""}>
            PIC phòng ban chủ trì
          </option>
          <option value="reviewer" ${selectedPowerPersonFilter === "reviewer" ? "selected" : ""}>
            Người góp ý
          </option>
          <option value="approval-delegate" ${selectedPowerPersonFilter === "approval-delegate" ? "selected" : ""}>
            Người được chuyển uỷ quyền phê duyệt
          </option>
          <option value="consultation-delegate" ${selectedPowerPersonFilter === "consultation-delegate" ? "selected" : ""}>
            Người được chuyển uỷ quyền Xin ý kiến
          </option>
          <option value="primary-signer" ${selectedPowerPersonFilter === "primary-signer" ? "selected" : ""}>
            Người ký chính
          </option>
          <option value="related-department-signer" ${selectedPowerPersonFilter === "related-department-signer" ? "selected" : ""}>
            Người ký trong list ban liên quan
          </option>
          <option value="related-leader-signer" ${selectedPowerPersonFilter === "related-leader-signer" ? "selected" : ""}>
            Người ký trong list lãnh đạo liên quan
          </option>
        </select>
      </label>
    </div>

    <div class="topbar-actions">
      <button class="topbar-share" type="button" title="Chia sẻ">
        <span class="material-symbols-outlined">ios_share</span>
        Share
        <span class="material-symbols-outlined">expand_more</span>
      </button>
      <button class="power-header-action" type="button" title="Toàn màn hình" aria-label="Toàn màn hình">
        <span class="material-symbols-outlined">fullscreen</span>
      </button>
      <button class="power-header-action" type="button" title="Tải xuống" aria-label="Tải xuống">
        <span class="material-symbols-outlined">download</span>
      </button>
      <button class="power-header-action" type="button" title="Cài đặt" aria-label="Cài đặt">
        <span class="material-symbols-outlined">settings</span>
      </button>
      <button class="power-header-action" type="button" title="Trợ giúp" aria-label="Trợ giúp">
        <span class="material-symbols-outlined">help</span>
      </button>
      <span class="workflow-avatar" title="Lê Văn Danh"></span>
    </div>
  `;
}

function renderPowerAppHeaders() {
  document.querySelectorAll("[data-power-app-header]").forEach((header) => {
    header.innerHTML = powerAppHeaderMarkup();
  });
}

renderWorkflowMenus();
syncSigningInboxColumnControls();
renderPowerAppHeaders();

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-power-person-filter]");

  if (!select) return;

  selectedPowerPersonFilter = select.value;
  document.querySelectorAll("[data-power-person-filter]").forEach((item) => {
    item.value = selectedPowerPersonFilter;
  });

  syncSigningListForRole();
  syncSigningInboxForRole();

  const activeSigningStatus =
    document.querySelector(".signing-card.active")?.dataset.status || "draft";
  renderSignDetailActions(activeSigningStatus);

  showToast(`Đã chọn: ${select.options[select.selectedIndex].text}.`);
});

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();

  return Promise.resolve();
}

function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }

  return fallbackCopyText(text);
}

function copyWorkflowText(targetId, successLabel = "Đã copy thông tin.") {
  const target = document.getElementById(targetId);
  const text = target?.textContent.trim();

  if (!text) return;

  copyTextToClipboard(text)
    .then(() => showToast(successLabel))
    .catch(() => showToast("Không thể copy thông tin.", "error"));
}

function shareWorkflowText(targetId) {
  const target = document.getElementById(targetId);
  const text = target?.textContent.trim();

  if (!text) return;

  if (navigator.share) {
    navigator
      .share({
        title: text,
        text
      })
      .catch(() => {});
    return;
  }

  copyTextToClipboard(text)
    .then(() => showToast("Đã copy nội dung chia sẻ."))
    .catch(() => showToast("Không thể chia sẻ thông tin.", "error"));
}

function formatBytes(size) {
  if (!size) return "--";

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function fileExtension(fileName) {
  return fileName.split(".").pop().toLowerCase();
}

function fileIconPath(extension) {
  const normalizedExtension = extension.toLowerCase();
  const iconMap = {
    doc: "docx",
    docx: "docx",
    xls: "xlsx",
    xlsx: "xlsx",
    ppt: "pptx",
    pptx: "pptx",
    pdf: "pdf"
  };

  return `assets/icons/${iconMap[normalizedExtension] || "docx"}.svg`;
}

function fileIconMarkup(extension, className = "file-type") {
  const normalizedExtension = extension.toLowerCase();
  const label = normalizedExtension.toUpperCase();

  return `
    <div class="${escapeHtml(className)}" title="${escapeHtml(label)}">
      <img
        src="${escapeHtml(fileIconPath(normalizedExtension))}"
        alt="${escapeHtml(label)}"
      />
    </div>
  `;
}

function formatDateForDisplay(value) {
  if (!value) return "--";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function validateIncomingFiles(target, incomingFiles) {
  const rules = fileRules[target];
  const availableSlots = rules.maxFiles - state[target].length;
  const accepted = [];
  const rejected = [];

  if (availableSlots <= 0) {
    return {
      accepted,
      rejected: [rules.messages.maxFiles]
    };
  }

  incomingFiles.forEach((file) => {
    const extension = fileExtension(file.name);

    if (!rules.extensions.includes(extension)) {
      rejected.push(rules.messages.invalidExtension);
      return;
    }

    if (rules.maxSize && file.size > rules.maxSize) {
      rejected.push(rules.messages.maxSize);
      return;
    }

    if (accepted.length >= availableSlots) {
      rejected.push(rules.messages.maxFiles);
      return;
    }

    accepted.push(file);
  });

  return { accepted, rejected };
}

function addFiles(target, fileList) {
  const incomingFiles = Array.from(fileList);

  if (!incomingFiles.length) return;

  const { accepted, rejected } = validateIncomingFiles(target, incomingFiles);

  if (accepted.length) {
    state[target].push(...accepted);
    renderFiles(target);
    renderDetailFiles(target);

    if (target === "draftFiles") {
      document.getElementById("draftError").classList.remove("visible");
    }
  }

  if (rejected.length) {
    showToast(rejected[0], "error");
  }
}

const mobileSidebarQuery = window.matchMedia("(max-width: 760px)");

function setSidebarCollapsed(collapsed) {
  appLayout.classList.toggle("sidebar-collapsed", collapsed);

  const expanded = !appLayout.classList.contains("sidebar-collapsed");
  document.getElementById("sidebarToggleIcon").textContent =
    expanded ? "‹" : "›";

  document
    .getElementById("sidebarToggle")
    .setAttribute("aria-expanded", String(expanded));

  document
    .getElementById("mobileMenuButton")
    .setAttribute("aria-expanded", String(expanded));
}

function syncSidebarForViewport() {
  setSidebarCollapsed(mobileSidebarQuery.matches);
}

document.getElementById("sidebarToggle").addEventListener("click", () => {
  setSidebarCollapsed(!appLayout.classList.contains("sidebar-collapsed"));
});

document.getElementById("mobileMenuButton").addEventListener("click", () => {
  setSidebarCollapsed(false);
});

document.getElementById("sidebarBackdrop").addEventListener("click", () => {
  setSidebarCollapsed(true);
});

mobileSidebarQuery.addEventListener("change", syncSidebarForViewport);
syncSidebarForViewport();

function renderFiles(target) {
  const container = document.getElementById(
    target === "draftFiles" ? "draftList" : "attachmentList"
  );

  const files = state[target];

  if (!files.length) {
    container.innerHTML = `
      <div class="empty-inline">
        ${
          target === "draftFiles"
            ? "Chưa có Văn bản dự thảo"
            : "Chưa có Văn bản đính kèm"
        }
      </div>
    `;
    return;
  }

  container.innerHTML = files
    .map((file, index) => `
      <div class="file-item">
        <div>${index + 1}</div>
        ${fileIconMarkup(fileExtension(file.name))}

        <div>
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-meta">
            ${(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>

        <button
          class="icon-button"
          type="button"
          onclick="removeFile('${target}', ${index})"
        >
          ✕
        </button>
      </div>
    `)
    .join("");
}

window.removeFile = function (target, index) {
  state[target].splice(index, 1);
  renderFiles(target);
  renderDetailFiles(target);
};

function configureFileInput(inputId, dropzoneId, target) {
  const input = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);

  if (!input || !dropzone) return;

  input.addEventListener("change", (event) => {
    addFiles(target, event.target.files);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    addFiles(target, event.dataTransfer.files);
  });
}

configureFileInput("draftInput", "draftDropzone", "draftFiles");
configureFileInput("attachmentInput", "attachmentDropzone", "attachmentFiles");
configureFileInput("detailDraftInput", "detailDraftDropzone", "draftFiles");
configureFileInput(
  "detailAttachmentInput",
  "detailAttachmentDropzone",
  "attachmentFiles"
);

function ensureSingleMainSigningFile(target) {
  const files = signingFiles[target];

  if (!files.length) return;

  files.forEach((file) => {
    if (!["main", "attachment"].includes(file.role)) {
      file.role = "attachment";
    }
  });

  const mainIndex = files.findIndex((file) => file.role === "main");
  const selectedMainIndex = mainIndex === -1 ? 0 : mainIndex;

  files.forEach((file, index) => {
    file.role = index === selectedMainIndex ? "main" : file.role;

    if (index !== selectedMainIndex && file.role === "main") {
      file.role = "attachment";
    }
  });
}

function renderSigningFiles(target) {
  const container = document.getElementById("signMainList");
  const files = signingFiles[target];
  const fileCount = document.getElementById("signFileCount");

  if (!container) return;

  ensureSingleMainSigningFile(target);

  if (fileCount) {
    fileCount.innerHTML = `
      <span class="material-symbols-outlined">description</span>
      ${files.length} file
    `;
  }

  if (!files.length) {
    container.innerHTML = `
      <div class="empty-inline">
        Chưa có file văn bản
      </div>
    `;
    return;
  }

  container.innerHTML = files
    .map((file, index) => {
      const extension = fileExtension(file.name);
      const hasCompletedDraftTag = file.completedDraft;

      return `
        <div class="file-item sign-file-item">
          <div>${index + 1}</div>
          ${fileIconMarkup(extension)}

          <div class="sign-file-info">
            <div class="file-name" title="${escapeHtml(file.name)}">
              ${escapeHtml(file.name)}
            </div>
            <div class="file-meta">
              ${(file.size / 1024 / 1024).toFixed(2)} MB
              ${
                hasCompletedDraftTag
                  ? '<span class="sign-file-tag">VB dự thảo hoàn thiện</span>'
                  : ""
              }
            </div>
          </div>

          <select
            class="sign-file-role"
            aria-label="Loại file"
            onchange="updateSigningFileRole(${index}, this.value)"
          >
            <option value="main" ${file.role === "main" ? "selected" : ""}>
              Văn bản chính
            </option>
            <option
              value="attachment"
              ${file.role === "attachment" ? "selected" : ""}
            >
              Tài liệu đính kèm
            </option>
          </select>

          <button
            class="icon-button sign-file-delete"
            type="button"
            onclick="removeSigningFile('${target}', ${index})"
            aria-label="Xóa"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `;
    })
    .join("");
}

function addSigningFiles(target, fileList) {
  const incomingFiles = Array.from(fileList);

  if (!incomingFiles.length) return;

  signingFiles[target].push(
    ...incomingFiles.map((file) => ({
      name: file.name,
      size: file.size,
      role: "attachment"
    }))
  );
  renderSigningFiles(target);
}

window.removeSigningFile = function (target, index) {
  signingFiles[target].splice(index, 1);
  renderSigningFiles(target);
};

window.updateSigningFileRole = function (index, role) {
  if (role === "main") {
    signingFiles.main.forEach((file, fileIndex) => {
      if (fileIndex !== index && file.role === "main") {
        file.role = "attachment";
      }
    });
  }

  signingFiles.main[index].role = role;
  renderSigningFiles("main");
};

function configureSigningFileInput(inputId, dropzoneId, target) {
  const input = document.getElementById(inputId);
  const dropzone = document.getElementById(dropzoneId);

  if (!input || !dropzone) return;

  input.addEventListener("change", (event) => {
    addSigningFiles(target, event.target.files);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    addSigningFiles(target, event.dataTransfer.files);
  });
}

configureSigningFileInput("signMainInput", "signMainDropzone", "main");

function validateCompletedDraftUploads(incomingFiles) {
  const accepted = [];
  const rejected = [];
  const maxFiles = 10;
  const maxSize = 50 * 1024 * 1024;
  const availableSlots = maxFiles - completedDraftUploadFiles.length;

  if (availableSlots <= 0) {
    return {
      accepted,
      rejected: ["Văn bản dự thảo hoàn thiện không được vượt quá 10 file."]
    };
  }

  incomingFiles.forEach((file) => {
    if (fileExtension(file.name) !== "docx") {
      rejected.push("Văn bản dự thảo hoàn thiện chỉ hỗ trợ định dạng .docx.");
      return;
    }

    if (file.size > maxSize) {
      rejected.push("Dung lượng mỗi file không được vượt quá 50MB.");
      return;
    }

    if (accepted.length >= availableSlots) {
      rejected.push("Văn bản dự thảo hoàn thiện không được vượt quá 10 file.");
      return;
    }

    accepted.push(file);
  });

  return {
    accepted,
    rejected: [...new Set(rejected)]
  };
}

function setCompletedDraftUploadError(message = "") {
  const error = document.getElementById("completedDraftUploadError");

  if (!error) return;

  error.textContent = message;
  error.classList.toggle("visible", Boolean(message));
}

function renderCompletedDraftUploadList() {
  const container = document.getElementById("completedDraftUploadList");

  if (!container) return;

  if (!completedDraftUploadFiles.length) {
    container.innerHTML = `
      <div class="empty-inline">
        Chưa có Văn bản dự thảo hoàn thiện
      </div>
    `;
    return;
  }

  container.innerHTML = completedDraftUploadFiles
    .map((file, index) => `
      <div class="file-item completed-draft-upload-item">
        <div>${index + 1}</div>
        ${fileIconMarkup(fileExtension(file.name))}

        <div class="detail-file-info">
          <div class="file-name" title="${escapeHtml(file.name)}">
            ${escapeHtml(file.name)}
          </div>
          <div class="file-meta">${escapeHtml(formatBytes(file.size))}</div>
        </div>

        <button
          class="icon-button sign-file-delete"
          type="button"
          onclick="removeCompletedDraftUpload(${index})"
          aria-label="Xóa"
        >
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `)
    .join("");
}

function addCompletedDraftUploads(fileList) {
  const incomingFiles = Array.from(fileList);

  if (!incomingFiles.length) return;

  const { accepted, rejected } = validateCompletedDraftUploads(incomingFiles);

  if (accepted.length) {
    completedDraftUploadFiles.push(...accepted);
    renderCompletedDraftUploadList();
    setCompletedDraftUploadError();
  }

  if (rejected.length) {
    setCompletedDraftUploadError(rejected[0]);
  }
}

function configureCompletedDraftUploadInput() {
  const input = document.getElementById("completedDraftInput");
  const dropzone = document.getElementById("completedDraftDropzone");

  if (!input || !dropzone) return;

  input.addEventListener("change", (event) => {
    addCompletedDraftUploads(event.target.files);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    addCompletedDraftUploads(event.dataTransfer.files);
  });
}

function syncCompletedDraftFilesToSigningFiles() {
  const completedFiles = detailDocuments.completedDraftFiles.map((file, index) => ({
    name: file.name,
    size: file.size,
    role: index === 0 ? "main" : "attachment",
    completedDraft: true
  }));
  const remainingFiles = signingFiles.main.filter((file) => !file.completedDraft);

  signingFiles.main.splice(
    0,
    signingFiles.main.length,
    ...completedFiles,
    ...remainingFiles
  );
  ensureSingleMainSigningFile("main");
  renderSigningFiles("main");
}

function openCompletedDraftModal() {
  completedDraftUploadFiles = [...detailDocuments.completedDraftFiles];
  renderCompletedDraftUploadList();
  setCompletedDraftUploadError();
  document.getElementById("completedDraftModal").classList.add("open");
}

function closeCompletedDraftModal() {
  completedDraftUploadFiles = [];
  renderCompletedDraftUploadList();
  setCompletedDraftUploadError();
  document.getElementById("completedDraftModal").classList.remove("open");
}

function confirmCompletedDraftUpload() {
  if (!completedDraftUploadFiles.length) {
    setCompletedDraftUploadError("Vui lòng tải lên Văn bản dự thảo hoàn thiện.");
    return;
  }

  detailDocuments.completedDraftFiles = [...completedDraftUploadFiles];
  syncCompletedDraftFilesToSigningFiles();
  renderDetailFiles("completedDraftFiles");
  closeCompletedDraftModal();
  showSignCreateScreen();
  showToast("Đã lưu Văn bản dự thảo hoàn thiện.");
}

window.removeCompletedDraftUpload = function (index) {
  completedDraftUploadFiles.splice(index, 1);
  renderCompletedDraftUploadList();
  setCompletedDraftUploadError();
};

configureCompletedDraftUploadInput();

function renderPeople(target) {
  const people = state[target];

  const container = document.getElementById(
    target === "commenters" ? "commenterList" : "ccList"
  );

  if (target === "commenters" && people.length) {
    document.getElementById("commenterError").classList.remove("visible");
  }

  if (!people.length) {
    container.innerHTML = `
      <div class="people-empty">
        ${
          target === "commenters"
            ? "Chưa chọn người góp ý"
            : "Chưa chọn người CC"
        }
      </div>
    `;
    renderDetailPeople(target);
    return;
  }

  container.innerHTML = `
    <div class="people-table-wrap">
      <table class="people-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">Họ và tên</th>
            <th class="col-position">Chức vụ</th>
            <th class="col-department">Đơn vị/Phòng ban</th>
            <th class="col-feedback">Góp ý</th>
            <th class="col-file">Đính kèm</th>
            <th class="col-time">Thời gian</th>
            <th class="col-actions">Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${people.map((person, index) => {
            const hasFeedback = person.feedbackStatus === "done";
            const fileCount = person.feedbackFiles?.length || 0;

            return `
              <tr>
                <td class="col-stt">${index + 1}</td>

                <td class="col-name">
                  <div class="person-name">
                    ${escapeHtml(person.fullName)}
                  </div>
                </td>

                <td class="col-position">
                  ${escapeHtml(person.position)}
                </td>

                <td class="col-department">
                  ${escapeHtml(person.department)}
                </td>

                <td class="col-feedback">
                  ${
                    hasFeedback
                      ? `
                        <div class="feedback-check-wrap">
                          <span
                            class="feedback-check"
                            tabindex="0"
                            aria-label="Đã góp ý"
                          >
                            ✓
                          </span>

                          <div class="feedback-tooltip">
                            ${escapeHtml(person.feedbackContent)}
                          </div>
                        </div>
                      `
                      : `
                        <span class="feedback-dash">–</span>
                      `
                  }
                </td>

                <td class="col-file">
                  <span class="file-count">${fileCount} tệp</span>
                </td>

                <td class="col-time">
                  <span class="muted">
                    ${escapeHtml(person.feedbackTime || "—")}
                  </span>
                </td>

                <td class="col-actions">
                  <div class="row-actions" aria-label="Thao tác">
                    <button
                      class="genco-button genco-button--secondary genco-button--small genco-button--icon-only"
                      type="button"
                      title="Xem"
                      aria-label="Xem"
                      onclick="viewPersonDetail('${target}', ${index})"
                    >
                      ${materialIcon("visibility")}
                    </button>

                    <button
                      class="genco-button genco-button--danger genco-button--small genco-button--icon-only"
                      type="button"
                      title="Xóa"
                      aria-label="Xóa"
                      onclick="removePerson('${target}', ${index})"
                    >
                      ${materialIcon("delete")}
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  renderDetailPeople(target);
}

function renderDetailPeople(target) {
  const people = state[target];
  const container = document.getElementById(
    target === "commenters" ? "detailCommenterList" : "detailCcList"
  );
  const counter = document.getElementById(
    target === "commenters" ? "detailCommenterCount" : "detailCcCount"
  );

  if (!container) return;

  if (counter) {
    counter.textContent = `${people.length} người`;
  }

  if (!people.length) {
    container.innerHTML = `
      <div class="people-empty">
        ${
          target === "commenters"
            ? "Chưa chọn người góp ý"
            : "Chưa chọn người CC"
        }
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="people-table-wrap">
      <table class="people-table detail-people-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th class="col-name">Họ và tên</th>
            <th class="col-position">Chức vụ</th>
            <th class="col-department">Đơn vị/Phòng ban</th>
            <th class="col-feedback">Góp ý</th>
            <th class="col-file">Đính kèm</th>
            <th class="col-time">Thời gian</th>
            <th class="col-actions">Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${people.map((person, index) => {
            const hasFeedback = person.feedbackStatus === "done";
            const fileCount = person.feedbackFiles?.length || 0;

            return `
              <tr>
                <td class="col-stt">${index + 1}</td>

                <td class="col-name">
                  <div class="person-name">
                    ${escapeHtml(person.fullName)}
                  </div>
                </td>

                <td class="col-position">
                  ${escapeHtml(person.position)}
                </td>

                <td class="col-department">
                  ${escapeHtml(person.department)}
                </td>

                <td class="col-feedback">
                  ${
                    hasFeedback
                      ? `
                        <div class="feedback-check-wrap">
                          <span
                            class="feedback-check"
                            tabindex="0"
                            aria-label="Đã góp ý"
                          >
                            ✓
                          </span>

                          <div class="feedback-tooltip">
                            ${escapeHtml(person.feedbackContent)}
                          </div>
                        </div>
                      `
                      : `
                        <span class="feedback-dash">–</span>
                      `
                  }
                </td>

                <td class="col-file">
                  <span class="file-count">${fileCount} tệp</span>
                </td>

                <td class="col-time">
                  <span class="muted">
                    ${escapeHtml(person.feedbackTime || "—")}
                  </span>
                </td>

                <td class="col-actions">
                  <div class="row-actions" aria-label="Thao tác">
                    <button
                      class="genco-button genco-button--secondary genco-button--small genco-button--icon-only"
                      type="button"
                      title="Xem"
                      aria-label="Xem"
                      onclick="viewPersonDetail('${target}', ${index})"
                    >
                      ${materialIcon("visibility")}
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

window.removePerson = function (target, index) {
  const person = state[target][index];

  if (!person) return;

  state[target].splice(index, 1);
  renderPeople(target);
  showToast("Đã xóa khỏi danh sách.");
};

function openPeopleModal(target) {
  state.peopleTarget = target;
  state.selectedPersonKey = "";

  document.getElementById("peopleModalError").classList.remove("visible");
  document.getElementById("peopleSearch").value = "";

  document.getElementById("peopleModalTitle").textContent =
    target === "commenters"
      ? "Chọn Người góp ý"
      : "Chọn Người CC";

  renderOrgUsers("");
  document.getElementById("peopleModal").classList.add("open");
}

function closePeopleModal() {
  document.getElementById("peopleModal").classList.remove("open");
}

function renderOrgUsers(keyword) {
  const normalized = keyword.trim().toLowerCase();

  const users = orgUsers.filter((user) =>
    `${user.fullName} ${user.position} ${user.department}`
      .toLowerCase()
      .includes(normalized)
  );

  document.getElementById("orgList").innerHTML = users
    .map((user) => `
      <label class="org-item ${!user.active ? "disabled" : ""}">
        <input
          type="radio"
          name="selectedPerson"
          value="${escapeHtml(user.id)}"
          ${!user.active ? "disabled" : ""}
        />

        <div>
          <div class="person-name">${escapeHtml(user.fullName)}</div>
          <div class="muted">
            ${escapeHtml(user.position)} · ${escapeHtml(user.department)}
          </div>
        </div>

        <span class="user-status">
          ${user.active ? "Đang hoạt động" : "Ngừng hoạt động"}
        </span>
      </label>
    `)
    .join("");

  document
    .querySelectorAll('input[name="selectedPerson"]')
    .forEach((radio) => {
      radio.addEventListener("change", (event) => {
        state.selectedPersonKey = event.target.value;
        document.getElementById("peopleModalError").classList.remove("visible");
      });
    });
}

document.getElementById("addCommenterButton").addEventListener("click", () => {
  openPeopleModal("commenters");
});

document.getElementById("addCcButton").addEventListener("click", () => {
  openPeopleModal("ccUsers");
});

document.getElementById("closePeopleModal").addEventListener(
  "click",
  closePeopleModal
);

document.getElementById("cancelPeople").addEventListener(
  "click",
  closePeopleModal
);

document.getElementById("peopleSearch").addEventListener("input", (event) => {
  renderOrgUsers(event.target.value);
});

document.getElementById("confirmPeople").addEventListener("click", () => {
  const selected = orgUsers.find(
    (user) => user.id === state.selectedPersonKey
  );

  if (!selected) {
    document.getElementById("peopleModalError").textContent =
      "Vui lòng chọn một người.";

    document
      .getElementById("peopleModalError")
      .classList.add("visible");

    return;
  }

  const existing = state[state.peopleTarget].some(
    (person) => person.id === selected.id
  );

  if (existing) {
    document.getElementById("peopleModalError").textContent =
      "Người này đã có trong danh sách.";

    document
      .getElementById("peopleModalError")
      .classList.add("visible");

    return;
  }

  const otherTarget =
    state.peopleTarget === "commenters" ? "ccUsers" : "commenters";

  const duplicateInOtherList = state[otherTarget].some(
    (person) =>
      person.id === selected.id && person.position === selected.position
  );

  if (duplicateInOtherList) {
    document.getElementById("peopleModalError").textContent =
      "Người dùng với chức vụ này đã tồn tại trong danh sách khác.";

    document
      .getElementById("peopleModalError")
      .classList.add("visible");

    return;
  }

  if (state[state.peopleTarget].length >= 50) {
    document.getElementById("peopleModalError").textContent =
      state.peopleTarget === "commenters"
        ? "Số lượng Người góp ý không được vượt quá 50 người."
        : "Số lượng Người CC không được vượt quá 50 người.";

    document
      .getElementById("peopleModalError")
      .classList.add("visible");

    return;
  }

  state[state.peopleTarget].push({
    ...selected,
    feedbackStatus: "pending",
    feedbackTime: "",
    feedbackContent: "",
    feedbackFiles: []
  });

  renderPeople(state.peopleTarget);
  closePeopleModal();
});

window.viewPersonDetail = function (target, index) {
  const person = state[target][index];

  if (!person) return;

  const files = person.feedbackFiles || [];

  document.getElementById("detailModalBody").innerHTML = `
    <div class="detail-person">
      <div class="detail-avatar">
        ${escapeHtml(initials(person.fullName))}
      </div>

      <div>
        <h3 class="detail-name">
          ${escapeHtml(person.fullName)}
        </h3>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-label">Người giao việc</div>
      <div class="detail-value">
        ${escapeHtml(
          `${state.assigner.fullName} (${state.assigner.email})`
        )}
      </div>

      <div class="detail-label">Phòng ban</div>
      <div class="detail-value">
        ${escapeHtml(person.department || "—")}
      </div>

      <div class="detail-label">Chức vụ</div>
      <div class="detail-value">
        ${escapeHtml(person.position || "—")}
      </div>

      <div class="detail-label">Thời gian góp ý</div>
      <div class="detail-value">
        ${escapeHtml(person.feedbackTime || "—")}
      </div>
    </div>

    <section class="detail-section">
      <h4 class="detail-section-title">Nội dung phản hồi</h4>

      ${
        person.feedbackContent
          ? `
            <div class="feedback-content">
              ${escapeHtml(person.feedbackContent)}
            </div>
          `
          : `
            <div class="detail-empty">
              Chưa có nội dung phản hồi
            </div>
          `
      }
    </section>

    <section class="detail-section">
      <h4 class="detail-section-title">
        Tệp đính kèm phản hồi
      </h4>

      ${
        files.length
          ? `
            <div class="detail-file-list">
              ${files.map((file) => `
                <div class="detail-file-item">
                  ${fileIconMarkup(file.extension, "detail-file-icon")}

                  <div>
                    <div class="detail-file-name">
                      ${escapeHtml(file.name)}
                    </div>

                    <div class="detail-file-size">
                      ${escapeHtml(file.size)}
                    </div>
                  </div>

  <button
    class="genco-button genco-button--secondary genco-button--small"
    type="button"
    onclick="showToast('Đang mở file')"
  >
    ${materialIcon("visibility")}
    Xem file
  </button>
                </div>
              `).join("")}
            </div>
          `
          : `
            <div class="detail-empty">
              Không có tệp đính kèm
            </div>
          `
      }
    </section>
  `;

  document.getElementById("detailModal").classList.add("open");
};

function closeDetailModal() {
  document.getElementById("detailModal").classList.remove("open");
}

document.getElementById("closeDetailModal").addEventListener(
  "click",
  closeDetailModal
);

document.getElementById("detailCloseButton").addEventListener(
  "click",
  closeDetailModal
);

document.getElementById("title").addEventListener("input", (event) => {
  document.getElementById("titleCounter").textContent =
    `${event.target.value.length}/200`;

  event.target.classList.remove("invalid");
  document.getElementById("titleError").classList.remove("visible");
});

document.getElementById("note").addEventListener("input", (event) => {
  document.getElementById("noteCounter").textContent =
    `${event.target.value.length}/2000`;
});

function updateSummaryCounter() {
  const summary = document.getElementById("summary");
  const counter = document.getElementById("summaryCounter");

  if (summary && counter) {
    counter.textContent = `${summary.value.length}/200`;
  }
}

document.getElementById("summary").addEventListener("input", updateSummaryCounter);
updateSummaryCounter();

document.getElementById("dueDate").addEventListener("change", (event) => {
  event.target.classList.remove("invalid");
  document.getElementById("dueDateError").classList.remove("visible");
});

function validateCreateForm() {
  const title = document.getElementById("title");
  const dueDate = document.getElementById("dueDate");
  const invalidTargets = [];

  let valid = true;

  title.classList.remove("invalid");
  dueDate.classList.remove("invalid");
  document.getElementById("titleError").classList.remove("visible");
  document.getElementById("dueDateError").classList.remove("visible");
  document.getElementById("draftError").classList.remove("visible");
  document.getElementById("commenterError").classList.remove("visible");

  if (!title.value.trim()) {
    title.classList.add("invalid");
    document.getElementById("titleError").classList.add("visible");
    invalidTargets.push(title);
    valid = false;
  }

  if (!dueDate.value) {
    dueDate.classList.add("invalid");
    document.getElementById("dueDateError").classList.add("visible");
    invalidTargets.push(dueDate);
    valid = false;
  }

  if (!state.draftFiles.length) {
    document.getElementById("draftError").classList.add("visible");
    invalidTargets.push(document.getElementById("draftDropzone"));
    valid = false;
  }

  if (!state.commenters.length) {
    document.getElementById("commenterError").classList.add("visible");
    invalidTargets.push(document.getElementById("commenterList"));
    valid = false;
  }

  if (!valid && invalidTargets.length) {
    invalidTargets[0].scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    if (typeof invalidTargets[0].focus === "function") {
      invalidTargets[0].focus({ preventScroll: true });
    }
  }

  return valid;
}

function renderWorkflowFileList(target, emptyText) {
  const files = detailDocuments[target] || [];

  if (!files.length) {
    return `<div class="empty-inline">${escapeHtml(emptyText)}</div>`;
  }

  return files
    .map((file, index) => {
      const extension = fileExtension(file.name);

      return `
        <div class="file-item workflow-detail-file-item">
          <div>${index + 1}</div>
          ${fileIconMarkup(extension)}

          <div class="detail-file-info">
            <div class="file-name" title="${escapeHtml(file.name)}">
              ${escapeHtml(file.name)}
            </div>
            <div class="file-meta">${escapeHtml(formatBytes(file.size))}</div>
          </div>

          <div class="detail-file-actions">
            <button
              class="genco-button genco-button--small genco-button--icon-only detail-file-action"
              type="button"
              title="Xem"
              aria-label="Xem"
              onclick="viewWorkflowFile('${target}', ${index})"
            >
              ${materialIcon("visibility")}
            </button>

            <button
              class="genco-button genco-button--small genco-button--icon-only detail-file-action"
              type="button"
              title="Tải"
              aria-label="Tải"
              onclick="downloadWorkflowFile('${target}', ${index})"
            >
              ${materialIcon("download")}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDetailFiles(target) {
  const containerMap = {
    completedDraftFiles: "detailCompletedDraftFiles",
    draftFiles: "detailDraftFiles",
    attachmentFiles: "detailAttachmentFiles"
  };
  const container = document.getElementById(containerMap[target]);

  if (!container) return;

  container.innerHTML = renderWorkflowFileList(
    target,
    target === "completedDraftFiles"
      ? "Chưa có Văn bản dự thảo hoàn thiện"
      : target === "draftFiles"
        ? "Chưa có Văn bản dự thảo"
        : "Chưa có Văn bản đính kèm"
  );
}

function renderSignDetailFiles() {
  const container = document.getElementById("signDetailFiles");
  const count = document.getElementById("signDetailAttachmentCount");

  if (!container) return;

  if (signingFiles.main.length) {
    ensureSingleMainSigningFile("main");
  }

  const files = signingFiles.main.length
    ? signingFiles.main
    : signDetailDemoFiles;

  if (count) {
    count.textContent = `${files.length} văn bản`;
  }

  container.innerHTML = files
    .map((file, index) => {
      const extension = fileExtension(file.name);
      const isMain = file.role === "main";

      return `
        <div class="sign-detail-file-row">
          <div class="sign-detail-file-index">
            ${index + 1}
          </div>
          ${fileIconMarkup(extension)}
          <div class="sign-detail-file-info">
            <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
            <span>${escapeHtml(extension.toUpperCase())} · ${escapeHtml(formatBytes(file.size))}</span>
          </div>
          <span class="sign-detail-main-badge ${isMain ? "active" : ""}">
            <span class="material-symbols-outlined">
              ${isMain ? "assignment_turned_in" : "attach_file"}
            </span>
            <span>${isMain ? "Văn bản chính" : "Tài liệu đính kèm"}</span>
          </span>
          <div class="detail-file-actions">
            <button class="genco-button genco-button--small genco-button--icon-only detail-file-action" type="button" title="Xem">
              ${materialIcon("visibility")}
            </button>
            <button class="genco-button genco-button--small genco-button--icon-only detail-file-action" type="button" title="Tải">
              ${materialIcon("download")}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

const signApprovalPeople = [
  {
    name: "Nguyễn Minh Anh",
    role: "Chuyên viên chính",
    unit: "Ban Pháp chế",
    content: "Đã hoàn thiện hồ sơ và gửi trình ký."
  },
  {
    name: "Trần Quốc Huy",
    role: "Trưởng Ban",
    unit: "Ban Pháp chế",
    content: "Đã kiểm tra hồ sơ và đồng ý trình cấp có thẩm quyền."
  },
  {
    name: "Nguyễn Thị Thu Hà",
    role: "Phó Trưởng Ban",
    unit: "Ban Hành chính và Nhân sự",
    group: "Ban Hành chính và Nhân sự",
    transferTarget: "Trần Văn Tuấn",
    content: "Đã rà soát nội dung thuộc phạm vi Ban Hành chính và Nhân sự."
  },
  {
    name: "Trần Văn Tuấn",
    role: "Trưởng phòng Nhân sự",
    unit: "Ban Hành chính và Nhân sự",
    group: "Ban Hành chính và Nhân sự",
    content: "Đồng ý nội dung trình ký sau khi tiếp nhận chuyển ký."
  },
  {
    name: "Phạm Quốc Bảo",
    role: "Phó Trưởng Ban",
    unit: "Ban Kỹ thuật",
    group: "Ban Kỹ thuật",
    content: "Đã kiểm tra các nội dung kỹ thuật và thống nhất trình ký."
  },
  {
    name: "Đặng Hoàng Anh",
    role: "Thành viên HĐQT",
    unit: "Văn phòng HĐQT",
    transferTarget: "Lê Quang Huy",
    content: "Thống nhất nội dung văn bản và đề nghị tiếp tục quy trình ký."
  },
  {
    name: "Lê Quang Huy",
    role: "Phó Tổng Giám đốc",
    unit: "Ban Điều hành",
    content: "Đã rà soát và đồng ý nội dung thuộc phạm vi phụ trách."
  },
  {
    name: "Nguyễn Minh Khoa",
    role: "Thành viên HĐQT",
    unit: "Hội đồng Quản trị",
    transferTarget: "Lê Văn Danh",
    content: "Thống nhất nội dung văn bản và đề nghị hoàn thiện thể thức phát hành."
  },
  {
    name: "Lê Văn Danh",
    role: "Tổng Giám đốc",
    unit: "Ban Điều hành",
    content:
      "Đồng ý phê duyệt văn bản theo nội dung trình, giao Ban Pháp chế phối hợp triển khai."
  }
];

const signingTimelineSteps = [
  { title: "Trình văn bản", people: [0] },
  { title: "Lãnh đạo Ban chủ trì", people: [1] },
  { title: "Lãnh đạo Ban liên quan", people: [2, 3, 4] },
  { title: "Lãnh đạo liên quan", people: [5, 6] },
  { title: "Lãnh đạo phê duyệt", people: [7, 8] }
];

const signHistoryIterationScenarios = {
  1: "rejected"
};

const signHistoryPersonStatuses = {
  submitted: { label: "Trình văn bản", className: "submitted", hasAction: true },
  "not-signed": { label: "Chưa ký", className: "not-signed" },
  "needs-sign": { label: "Cần ký", className: "needs-sign" },
  signed: { label: "Đã ký", className: "signed", hasAction: true },
  rejected: { label: "Từ chối ký", className: "rejected", hasAction: true },
  transferred: {
    label: "Chuyển người ký",
    className: "transferred",
    hasAction: true
  },
  withdrawn: { label: "Đã thu hồi", className: "withdrawn", hasAction: true },
  draft: { label: "Dự thảo", className: "draft" },
  authoring: { label: "Soạn thảo", className: "authoring" }
};

const signHistoryTimes = [
  "13/07/2026 10:30",
  "13/07/2026 10:46",
  "13/07/2026 11:05",
  "13/07/2026 11:32",
  "13/07/2026 11:48",
  "13/07/2026 13:20",
  "13/07/2026 13:42",
  "13/07/2026 14:15",
  "13/07/2026 14:36"
];

const signHistorySkipReason =
  "Không có người ký được thiết lập tại bước này. Luồng tự động chuyển sang bước tiếp theo.";

function signHistoryPerson(personIndex, status, overrides = {}) {
  const config = signHistoryPersonStatuses[status];
  const person = signApprovalPeople[personIndex];

  return {
    personIndex,
    status,
    time: config?.hasAction ? signHistoryTimes[personIndex] : "",
    content: config?.hasAction ? person.content : "",
    ...overrides
  };
}

function signHistoryStep(state, people = []) {
  return { state, people };
}

function getSignHistoryScenario(scenarioKey) {
  const submitted = () => signHistoryPerson(0, "submitted");
  const signed = (index) => signHistoryPerson(index, "signed");
  const notSigned = (index) => signHistoryPerson(index, "not-signed");
  const needsSign = (index) => signHistoryPerson(index, "needs-sign");
  const completedSteps = () => [
    signHistoryStep("done", [submitted()]),
    signHistoryStep("done", [signed(1)]),
    signHistoryStep("done", [signed(2), signed(3), signed(4)]),
    signHistoryStep("done", [signed(5), signed(6)]),
    signHistoryStep("done", [signed(7), signed(8)])
  ];

  if (scenarioKey === "draft") {
    return {
      steps: [
        signHistoryStep("active", [signHistoryPerson(0, "draft")]),
        signHistoryStep("pending", [notSigned(1)]),
        signHistoryStep("pending", [notSigned(2), notSigned(3), notSigned(4)]),
        signHistoryStep("pending", [notSigned(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ]
    };
  }

  if (scenarioKey === "authoring") {
    return {
      steps: [
        signHistoryStep("active", [signHistoryPerson(0, "authoring")]),
        signHistoryStep("pending", [notSigned(1)]),
        signHistoryStep("pending", [notSigned(2), notSigned(3), notSigned(4)]),
        signHistoryStep("pending", [notSigned(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ]
    };
  }

  if (scenarioKey === "withdrawn") {
    return {
      steps: [
        signHistoryStep("rejected", [
          signHistoryPerson(0, "withdrawn", {
            content: "Thu hồi hồ sơ để cập nhật nội dung văn bản."
          })
        ]),
        signHistoryStep("pending", [notSigned(1)]),
        signHistoryStep("pending", [notSigned(2), notSigned(3), notSigned(4)]),
        signHistoryStep("pending", [notSigned(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ],
      outcome: { label: "Đã thu hồi", state: "pending", icon: "undo" }
    };
  }

  if (scenarioKey === "skip-3") {
    return {
      steps: [
        signHistoryStep("done", [submitted()]),
        signHistoryStep("done", [signed(1)]),
        signHistoryStep("skipped"),
        signHistoryStep("active", [needsSign(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ]
    };
  }

  if (scenarioKey === "skip-4") {
    return {
      steps: [
        signHistoryStep("done", [submitted()]),
        signHistoryStep("done", [signed(1)]),
        signHistoryStep("done", [signed(2), signed(3), signed(4)]),
        signHistoryStep("skipped"),
        signHistoryStep("active", [needsSign(7), notSigned(8)])
      ]
    };
  }

  if (scenarioKey === "skip-3-4") {
    return {
      steps: [
        signHistoryStep("done", [submitted()]),
        signHistoryStep("done", [signed(1)]),
        signHistoryStep("skipped"),
        signHistoryStep("skipped"),
        signHistoryStep("active", [needsSign(7), notSigned(8)])
      ]
    };
  }

  if (scenarioKey === "rejected") {
    return {
      steps: [
        signHistoryStep("done", [submitted()]),
        signHistoryStep("done", [signed(1)]),
        signHistoryStep("rejected", [
          signHistoryPerson(2, "rejected", {
            content:
              "Đề nghị rà soát lại số liệu chi phí và hoàn thiện căn cứ pháp lý trước khi trình lại."
          }),
          notSigned(3),
          notSigned(4)
        ]),
        signHistoryStep("pending", [notSigned(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ],
      outcome: { label: "Đã trả lại", state: "rejected", icon: "undo" }
    };
  }

  if (scenarioKey === "transferred") {
    return {
      steps: [
        signHistoryStep("done", [submitted()]),
        signHistoryStep("done", [signed(1)]),
        signHistoryStep("active", [
          signHistoryPerson(2, "transferred", {
            content: "Chuyển Trưởng phòng Nhân sự tiếp tục kiểm tra và ký văn bản.",
            transferTo: 3
          }),
          signHistoryPerson(3, "needs-sign", { isTransferRecipient: true }),
          notSigned(4)
        ]),
        signHistoryStep("pending", [notSigned(5), notSigned(6)]),
        signHistoryStep("pending", [notSigned(7), notSigned(8)])
      ]
    };
  }

  if (["completed", "completed-transferred"].includes(scenarioKey)) {
    const steps = completedSteps();

    if (scenarioKey === "completed-transferred") {
      steps[2] = signHistoryStep("done", [
        signHistoryPerson(2, "transferred", {
          content: "Chuyển Trưởng phòng Nhân sự tiếp tục kiểm tra và ký văn bản.",
          transferTo: 3
        }),
        signHistoryPerson(3, "signed", { isTransferRecipient: true }),
        signed(4)
      ]);
    }

    return {
      steps,
      outcome: { label: "Hoàn thành", state: "done", icon: "check" }
    };
  }

  return {
    steps: [
      signHistoryStep("done", [submitted()]),
      signHistoryStep("done", [signed(1)]),
      signHistoryStep("active", [needsSign(2), notSigned(3), notSigned(4)]),
      signHistoryStep("pending", [notSigned(5), notSigned(6)]),
      signHistoryStep("pending", [notSigned(7), notSigned(8)])
    ]
  };
}

const signingStatusConfig = {
  draft: {
    label: "Bản nháp",
    cardClass: "draft",
    actionMode: "menu",
    actions: ["submit", "edit", "add-new", "cancel-sign", "cancel-draft"]
  },
  waiting: {
    label: "Chờ ký",
    cardClass: "blue",
    actionMode: "menu",
    actions: ["add-new", "recall"]
  },
  signing: {
    label: "Đang ký",
    cardClass: "violet",
    actionMode: "direct",
    actions: ["add-new"]
  },
  rejected: {
    label: "Từ chối",
    cardClass: "red",
    actionMode: "menu",
    actions: ["resubmit", "edit", "add-new"]
  },
  recalled: {
    label: "Thu hồi",
    cardClass: "gray",
    actionMode: "menu",
    actions: ["resubmit", "edit", "add-new"]
  },
  signed: {
    label: "Đã ký",
    cardClass: "green",
    actionMode: "direct",
    actions: ["add-new", "complete"]
  }
};

function getSigningCardPresentation(statusKey) {
  if (statusKey === "rejected") {
    return {
      statusLabel: "Bản nháp",
      statusClass: "draft",
      tagLabel: "Trả lại",
      tagClass: "returned"
    };
  }

  if (statusKey === "recalled") {
    return {
      statusLabel: "Bản nháp",
      statusClass: "draft",
      tagLabel: "Thu hồi",
      tagClass: "recalled"
    };
  }

  const statusConfig = signingStatusConfig[statusKey] || signingStatusConfig.draft;

  return {
    statusLabel: statusConfig.label,
    statusClass: statusConfig.cardClass,
    tagLabel: "-",
    tagClass: "is-empty"
  };
}

function applySigningCardPresentation(card, statusKey) {
  if (!card) return;

  const presentation = getSigningCardPresentation(statusKey);
  const status = card.querySelector("em");
  const tag = card.querySelector("[data-signing-label]");

  if (status) {
    status.textContent = presentation.statusLabel;
    status.className = presentation.statusClass;
  }

  if (tag) {
    tag.textContent = presentation.tagLabel;
    tag.className = `signing-card-label ${presentation.tagClass}`;
  }
}

const signActionConfig = {
  edit: { label: "Chỉnh sửa", icon: "edit", variant: "secondary" },
  submit: { label: "Trình ký", icon: "send", variant: "primary" },
  resubmit: { label: "Trình ký lại", icon: "send", variant: "primary" },
  recall: { label: "Thu hồi", icon: "undo", variant: "secondary" },
  "cancel-sign": {
    label: "Huỷ trình ký",
    icon: "delete",
    variant: "danger-secondary"
  },
  "cancel-draft": {
    label: "Huỷ dự thảo",
    icon: "delete_sweep",
    variant: "danger-secondary"
  },
  "add-new": { label: "Thêm mới", icon: "add", variant: "secondary" },
  complete: { label: "Hoàn thành", icon: "task_alt", variant: "primary" }
};

function signingTimelineState(statusKey) {
  const card = document.querySelector(".signing-card.active");

  initializeSigningFlowState(card);

  const flow = {
    department: card?.dataset.departmentSignerState || "pending",
    leader: card?.dataset.leaderSignerState || "pending",
    primary: card?.dataset.primarySignerState || "pending"
  };

  if (statusKey === "signed") {
    flow.department = "approved";
    flow.leader = "approved";
    flow.primary = "approved";
  }

  if (
    statusKey === "rejected" &&
    !Object.values(flow).some((state) => state === "rejected")
  ) {
    flow.department = "rejected";
  }

  if (statusKey === "draft") {
    return { flow, phases: ["current", "pending", "pending", "pending", "pending"] };
  }

  if (statusKey === "recalled") {
    return { flow, phases: ["done", "current", "stopped", "stopped", "stopped"] };
  }

  const phases = ["done", "done", "pending", "pending", "pending"];

  if (["rejected", "stopped"].includes(flow.department)) {
    phases[2] = "current";
    phases[3] = "stopped";
    phases[4] = "stopped";
    return { flow, phases };
  }

  if (flow.department !== "approved") {
    phases[2] = "current";
    return { flow, phases };
  }

  phases[2] = "done";

  if (["rejected", "stopped"].includes(flow.leader)) {
    phases[3] = "current";
    phases[4] = "stopped";
    return { flow, phases };
  }

  if (flow.leader !== "approved") {
    phases[3] = "current";
    return { flow, phases };
  }

  phases[3] = "done";

  if (["rejected", "stopped"].includes(flow.primary)) {
    phases[4] = "current";
    return { flow, phases };
  }

  phases[4] = flow.primary === "approved" ? "done" : "current";
  return { flow, phases };
}

function signingTimelinePersonStatus(stepIndex, position, phase, flow) {
  if (phase === "stopped") {
    return { label: "Đã dừng", className: "stopped" };
  }

  if (phase === "done") {
    const label = stepIndex === 0 ? "Đã trình" : stepIndex === 1 ? "Đã phê duyệt" : "Đã ký";
    return { label, className: "green" };
  }

  if (phase === "pending") {
    const label = stepIndex < 2 ? "Chưa thực hiện" : "Chưa ký";
    return { label, className: "gray" };
  }

  if (stepIndex === 0) {
    return { label: "Đang thực hiện", className: "blue" };
  }

  if (stepIndex === 1) {
    return { label: "Chờ phê duyệt", className: "blue" };
  }

  const flowState =
    stepIndex === 2 ? flow.department : stepIndex === 3 ? flow.leader : flow.primary;

  if (flowState === "stopped") {
    return { label: "Đã dừng", className: "stopped" };
  }

  if (flowState === "rejected") {
    return position === 0
      ? { label: "Từ chối ký", className: "red" }
      : { label: "Đã dừng", className: "stopped" };
  }

  if (flowState === "transferred") {
    return position === 0
      ? { label: "Đã chuyển ký", className: "violet" }
      : position === 1
        ? { label: "Cần ký", className: "blue" }
        : { label: "Chưa ký", className: "gray" };
  }

  return position === 0
    ? { label: "Cần ký", className: "blue" }
    : { label: "Chưa đến lượt", className: "gray" };
}

function renderSignHistoryPeople(step) {
  let currentGroup = "";

  return step.people
    .map((entry) => {
      const person = signApprovalPeople[entry.personIndex];
      const status = signHistoryPersonStatuses[entry.status];
      const groupMarkup =
        person.group && person.group !== currentGroup
          ? `<div class="signing-history-group">
               <span class="material-symbols-outlined">corporate_fare</span>
               ${escapeHtml(person.group)}
             </div>`
          : "";
      const transferMarkup = entry.transferTo
          ? `<small class="signing-history-transfer">
               <span class="material-symbols-outlined">subdirectory_arrow_right</span>
               ${escapeHtml(signApprovalPeople[entry.transferTo].name)}
             </small>`
          : "";
      const transferConnector = entry.isTransferRecipient
        ? `<div class="sign-history-transfer-connector">
             <span class="material-symbols-outlined">subdirectory_arrow_right</span>
             Chuyển người ký đến
           </div>`
        : "";
      const contentMarkup = entry.content
          ? `<button
               class="signing-history-content"
               type="button"
               data-sign-content-index="${entry.personIndex}"
               data-sign-history-content="${escapeHtml(entry.content)}"
               data-sign-history-status="${escapeHtml(status.label)}"
               data-full-content="${escapeHtml(entry.content)}"
               aria-label="Xem nội dung xử lý của ${escapeHtml(person.name)}"
             >
               <span class="material-symbols-outlined">visibility</span>
               <span>${escapeHtml(entry.content)}</span>
             </button>`
          : `<span class="signing-history-empty">-</span>`;
      const timeMarkup = status.hasAction && entry.time
        ? `<time>${escapeHtml(entry.time)}</time>`
        : "";

      currentGroup = person.group || currentGroup;

      return `
        ${groupMarkup}
        ${transferConnector}
        <div class="signing-history-person${
          entry.isTransferRecipient ? " is-transfer-recipient" : ""
        }">
          <div class="signing-history-person-main">
            <div class="signing-history-person-name">
              <strong>${escapeHtml(person.name)}</strong>
            </div>
            <span>${escapeHtml(person.role)} · ${escapeHtml(person.unit)}</span>
            ${transferMarkup}
          </div>
          ${contentMarkup}
          <div class="signing-history-person-status">
            <em class="${status.className}">${escapeHtml(status.label)}</em>
            ${timeMarkup}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSignApprovalTable(statusKey) {
  const container = document.getElementById("signHistoryTimeline");

  if (!container) return;

  const selectedIteration =
    document.querySelector("[data-sign-history-iteration].active")?.dataset
      .signHistoryIteration || "2";
  const statusScenario = {
    draft: "draft",
    rejected: "rejected",
    recalled: "withdrawn",
    signed: "completed"
  }[statusKey];
  const scenarioKey =
    signHistoryIterationScenarios[selectedIteration] || statusScenario || "full";
  const scenario = getSignHistoryScenario(scenarioKey);
  const context = document.getElementById("signHistoryIterationContext");

  if (context) {
    context.textContent = scenario.outcome?.label ||
      (selectedIteration === "2" ? "Lần trình hiện tại" : "Lần trình trước");
  }

  container.className = "sign-approval-table signing-timeline";
  container.dataset.scenario = scenarioKey;
  container.innerHTML = `
    ${
      scenario.outcome
        ? `<div
             class="sign-history-outcome ${scenario.outcome.state}"
             data-sign-history-outcome
             data-history-line-state="${scenario.outcome.state}"
           >
             <span class="sign-history-outcome-marker material-symbols-outlined">
               ${scenario.outcome.icon}
             </span>
             <strong>${escapeHtml(scenario.outcome.label)}</strong>
           </div>`
        : ""
    }
    ${signingTimelineSteps
      .map((step, index) => ({
        step,
        index,
        historyStep: scenario.steps[index]
      }))
      .reverse()
      .map(({ step, index, historyStep }) => {
        const isSkipped = historyStep.state === "skipped";
        const tooltipMarkup = isSkipped
          ? `<span
               class="sign-history-skip-tooltip material-symbols-outlined"
               tabindex="0"
               role="img"
               aria-label="Giải thích bước bị bỏ qua"
               data-tooltip="${escapeHtml(signHistorySkipReason)}"
             >info</span>`
          : "";

        return `
          <div
            class="signing-timeline-step ${historyStep.state}"
            data-sign-history-step
            data-history-step-index="${index}"
            data-history-line-state="${historyStep.state}"
          >
            <span class="signing-timeline-marker">${index + 1}</span>
            <div class="signing-timeline-card">
              <div class="sign-history-step-title-row">
                <h3>${escapeHtml(step.title)}</h3>
                ${tooltipMarkup}
              </div>
              ${
                isSkipped
                  ? ""
                  : `<div class="signing-timeline-people">
                       ${renderSignHistoryPeople(historyStep)}
                     </div>`
              }
            </div>
          </div>
        `;
      })
      .join("")}
  `;

  requestAnimationFrame(drawSignHistorySegments);
}

function drawSignHistorySegments() {
  const timeline = document.getElementById("signHistoryTimeline");

  if (!timeline || !timeline.offsetParent) return;

  timeline
    .querySelectorAll(".sign-history-line")
    .forEach((line) => line.remove());

  let stepNodes = [...timeline.querySelectorAll("[data-sign-history-step]")]
    .filter((step) => !step.classList.contains("skipped"))
    .sort(
      (first, second) =>
        Number(first.dataset.historyStepIndex) -
        Number(second.dataset.historyStepIndex)
    )
    .map((step) => ({
      node: step,
      marker: step.querySelector(".signing-timeline-marker")
    }));
  const outcome = timeline.querySelector("[data-sign-history-outcome]");

  if (outcome?.classList.contains("rejected")) {
    const rejectedStep = stepNodes.find((step) =>
      step.node.classList.contains("rejected")
    );

    if (rejectedStep) {
      const rejectedStepIndex = Number(
        rejectedStep.node.dataset.historyStepIndex
      );

      stepNodes = stepNodes.filter(
        (step) =>
          Number(step.node.dataset.historyStepIndex) <= rejectedStepIndex
      );
    }
  }

  if (outcome) {
    stepNodes.push({
      node: outcome,
      marker: outcome.querySelector(".sign-history-outcome-marker")
    });
  }

  const timelineRect = timeline.getBoundingClientRect();
  const allMarkers = [
    ...timeline.querySelectorAll(
      "[data-sign-history-step] .signing-timeline-marker"
    )
  ];

  stepNodes.slice(0, -1).forEach((from, index) => {
    const to = stepNodes[index + 1];
    const fromRect = from.marker.getBoundingClientRect();
    const toRect = to.marker.getBoundingClientRect();
    const fromY = fromRect.top + fromRect.height / 2 - timelineRect.top;
    const toY = toRect.top + toRect.height / 2 - timelineRect.top;
    const destinationState = to.node.dataset.historyLineState || "pending";
    const lineX = fromRect.left + fromRect.width / 2 - timelineRect.left;
    const rangeStart = Math.min(fromY, toY);
    const rangeEnd = Math.max(fromY, toY);
    const bypassGaps = allMarkers
      .filter((marker) => marker !== from.marker && marker !== to.marker)
      .map((marker) => {
        const rect = marker.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - timelineRect.top;

        return {
          start: center - rect.height / 2 - 5,
          end: center + rect.height / 2 + 5
        };
      })
      .filter((gap) => gap.start > rangeStart && gap.end < rangeEnd)
      .sort((first, second) => first.start - second.start);
    const segments = [];
    let segmentStart = rangeStart;

    bypassGaps.forEach((gap) => {
      if (gap.start > segmentStart) {
        segments.push({ start: segmentStart, end: gap.start });
      }

      segmentStart = Math.max(segmentStart, gap.end);
    });

    if (segmentStart < rangeEnd) {
      segments.push({ start: segmentStart, end: rangeEnd });
    }

    segments.forEach((segment) => {
      const line = document.createElement("span");

      line.className = `sign-history-line ${destinationState}`;
      line.dataset.historyConnection = `${
        from.node.dataset.historyStepIndex || "outcome"
      }-${to.node.dataset.historyStepIndex || "outcome"}`;
      line.style.top = `${segment.start}px`;
      line.style.left = `${lineX}px`;
      line.style.height = `${segment.end - segment.start}px`;
      timeline.prepend(line);
    });
  });
}

const signerRoleFlow = {
  "related-department-signer": {
    stateKey: "departmentSignerState",
    recipientKey: "departmentSignerTransferRecipient",
    decisionContentKey: "departmentSignerDecisionContent",
    transferContentKey: "departmentSignerTransferContent",
    prerequisites: []
  },
  "related-leader-signer": {
    stateKey: "leaderSignerState",
    recipientKey: "leaderSignerTransferRecipient",
    decisionContentKey: "leaderSignerDecisionContent",
    transferContentKey: "leaderSignerTransferContent",
    prerequisites: ["departmentSignerState"]
  },
  "primary-signer": {
    stateKey: "primarySignerState",
    recipientKey: "primarySignerTransferRecipient",
    decisionContentKey: "primarySignerDecisionContent",
    transferContentKey: "primarySignerTransferContent",
    prerequisites: ["departmentSignerState", "leaderSignerState"]
  }
};

function isSignerRole() {
  return Boolean(signerRoleFlow[selectedPowerPersonFilter]);
}

function initializeSigningFlowState(card) {
  if (!card || card.dataset.signingFlowInitialized === "true") return;

  card.dataset.departmentSignerState = "pending";
  card.dataset.leaderSignerState = "pending";
  card.dataset.primarySignerState = "pending";

  if (card.dataset.status === "signing") {
    card.dataset.departmentSignerState = "approved";
  }

  if (card.dataset.status === "signed") {
    card.dataset.departmentSignerState = "approved";
    card.dataset.leaderSignerState = "approved";
    card.dataset.primarySignerState = "approved";
  }

  card.dataset.signingFlowInitialized = "true";
}

function activeSignerRoleState() {
  const card = document.querySelector(".signing-card.active");
  const role = signerRoleFlow[selectedPowerPersonFilter];

  initializeSigningFlowState(card);

  if (!card || !role) {
    return {
      card,
      role,
      state: "pending",
      recipient: "",
      prerequisitesSigned: false
    };
  }

  return {
    card,
    role,
    state: card.dataset[role.stateKey] || "pending",
    recipient: card.dataset[role.recipientKey] || "",
    prerequisitesSigned: role.prerequisites.every(
      (stateKey) => card.dataset[stateKey] === "approved"
    )
  };
}

function renderSignerRoleActions(container) {
  const { card, state, prerequisitesSigned } = activeSignerRoleState();
  const terminalStatus = ["signed", "rejected", "recalled"].includes(
    card?.dataset.status
  );
  const hasCompletedAction = state === "approved" || state === "rejected";
  const canProcess =
    !terminalStatus &&
    !hasCompletedAction &&
    state === "pending" &&
    prerequisitesSigned;
  const canViewSignedFile =
    !terminalStatus && !hasCompletedAction && !canProcess;
  const hideActionBar = terminalStatus || hasCompletedAction;

  container.classList.toggle("is-empty", hideActionBar);

  container.innerHTML = `
    ${
      canProcess
        ? `
          <button
            class="genco-button genco-button--primary"
            type="button"
            data-related-signer-action="approve"
          >
            <span class="material-symbols-outlined">check_circle</span>
            Đồng ý
          </button>
          <button
            class="genco-button genco-button--danger-secondary"
            type="button"
            data-related-signer-action="reject"
          >
            <span class="material-symbols-outlined">cancel</span>
            Từ chối
          </button>
          <button
            class="genco-button genco-button--secondary"
            type="button"
            data-related-signer-action="transfer"
          >
            <span class="material-symbols-outlined">forward_to_inbox</span>
            Chuyển ký
          </button>
        `
        : ""
    }
    ${
      canProcess || canViewSignedFile
        ? `
          <button
            class="genco-button genco-button--secondary"
            type="button"
            data-related-signer-action="view-signed-file"
          >
            <span class="material-symbols-outlined">visibility</span>
            Xem file ký
          </button>
        `
        : ""
    }
  `;
}

function renderSignDetailActions(statusKey) {
  const container = document.getElementById("signDetailActions");
  const config = signingStatusConfig[statusKey] || signingStatusConfig.draft;
  const activeCard = document.querySelector(".signing-card.active");
  const actions =
    statusKey === "rejected" && activeCard?.dataset.edited !== "true"
      ? ["edit", "add-new"]
      : config.actions;

  if (!container) return;

  if (isSignerRole()) {
    renderSignerRoleActions(container);
    return;
  }

  container.classList.remove("is-empty");

  const actionMarkup = actions
    .map((actionKey) => {
      const action = signActionConfig[actionKey];
      const dangerClass = actionKey.startsWith("cancel-") ? " danger" : "";

      if (config.actionMode === "menu") {
        return `
          <button
            class="sign-execute-menu-item${dangerClass}"
            type="button"
            role="menuitem"
            data-sign-action="${actionKey}"
          >
            <span class="material-symbols-outlined">${action.icon}</span>
            ${action.label}
          </button>
        `;
      }

      return `
        <button
          class="genco-button genco-button--${action.variant}"
          type="button"
          data-sign-action="${actionKey}"
        >
          <span class="material-symbols-outlined">${action.icon}</span>
          ${action.label}
        </button>
      `;
    })
    .join("");

  container.innerHTML =
    config.actionMode === "menu"
      ? `
        <div class="sign-execute">
          <button
            class="genco-button genco-button--primary"
            type="button"
            data-sign-menu-toggle
            aria-haspopup="true"
            aria-expanded="false"
          >
            <span class="material-symbols-outlined">bolt</span>
            Thực hiện
            <span class="material-symbols-outlined sign-execute-chevron">expand_more</span>
          </button>
          <div class="sign-execute-menu" role="menu">
            ${actionMarkup}
          </div>
        </div>
      `
      : actionMarkup;
}

function syncSignSummaryFromActiveCard() {
  const activeCard = document.querySelector(".signing-card.active");
  const summary = activeCard
    ?.querySelector(".signing-card-summary")
    ?.textContent.trim();
  const code = activeCard?.querySelector("strong")?.textContent.trim();
  const statusKey = activeCard?.dataset.status || "draft";
  const statusConfig = signingStatusConfig[statusKey] || signingStatusConfig.draft;
  const overviewTitleTarget = document.getElementById("signDetailDraftTitle");
  const overviewCodeTarget = document.getElementById("signDetailDraftCode");
  const codeTarget = document.getElementById("signDetailCodeValue");
  const statusTarget = document.getElementById("signDetailStatus");

  if (summary && overviewTitleTarget) {
    overviewTitleTarget.textContent = summary;
    overviewTitleTarget.title = summary;
  }

  if (code && codeTarget) {
    codeTarget.textContent = code;
  }

  if (code && overviewCodeTarget) {
    overviewCodeTarget.textContent = code;
  }

  if (statusTarget) {
    statusTarget.textContent = statusConfig.label;
    statusTarget.className = `sign-status-pill ${statusKey}`;
  }

  renderSignApprovalTable(statusKey);
  renderSignDetailActions(statusKey);
}

function updateActiveSigningStatus(statusKey) {
  const activeCard = document.querySelector(".signing-card.active");
  const statusConfig = signingStatusConfig[statusKey];

  if (!activeCard || !statusConfig) return;

  activeCard.dataset.status = statusKey;
  applySigningCardPresentation(activeCard, statusKey);
  syncSignSummaryFromActiveCard();
  updateSigningListCount();
  applySigningFilter("all", false);
}

function openWorkflowFile(target, index, shouldDownload) {
  const file = (detailDocuments[target] || [])[index];

  if (!file) return;

  if (!(file instanceof File)) {
    if (!shouldDownload) {
      showToast(`Xem tài liệu: ${file.name}`);
      return;
    }

    const blob = new Blob([`Tài liệu mẫu: ${file.name}`], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }

  const url = URL.createObjectURL(file);

  if (shouldDownload) {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    window.open(url, "_blank", "noopener");
  }

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

window.viewWorkflowFile = function (target, index) {
  openWorkflowFile(target, index, false);
};

window.downloadWorkflowFile = function (target, index) {
  openWorkflowFile(target, index, true);
};

function hydrateWorkflowListFromForm() {
  const title = document.getElementById("title").value.trim() || "67868";
  const dueDate = formatDateForDisplay(document.getElementById("dueDate").value);
  const note = document.getElementById("note").value.trim() || "--";
  const createdAt = dueDate === "--" ? "12/07/2026 16:18" : `${dueDate} 16:18`;
  const creator = {
    fullName: state.assigner.fullName || "Nguyễn Minh Anh",
    position: state.assigner.position || "Chuyên viên chính",
    department: state.assigner.department || "Ban Pháp chế",
    email: state.assigner.email || "nguyen.minh.anh@genco3.vn"
  };

  document.getElementById("createdDraftCardTitle").textContent = title;
  document.getElementById("createdDraftCardDate").textContent = dueDate;
  document.getElementById("detailDraftTitle").textContent = title;
  document.getElementById("signDetailDraftTitle").textContent = title;
  syncSignSummaryFromActiveCard();
  document.getElementById("detailCreatorName").textContent = creator.fullName;
  document.getElementById("signDetailCreatorName").textContent = creator.fullName;
  document.getElementById("detailCreatorPosition").textContent = creator.position;
  document.getElementById("signDetailCreatorPosition").textContent =
    creator.position;
  document.getElementById("detailCreatorDepartment").textContent =
    creator.department;
  document.getElementById("signDetailCreatorDepartment").textContent =
    creator.department;
  document.getElementById("detailCreatorEmail").textContent = creator.email;
  document.getElementById("signDetailCreatorEmail").textContent = creator.email;
  document.getElementById("readonlyTitle").textContent = title;
  document.getElementById("readonlyDueDate").textContent = dueDate;
  document.getElementById("readonlyNote").textContent = note;
  document.getElementById("detailCreatedAt").textContent = createdAt;
  document.getElementById("signDetailCreatedAt").textContent = createdAt;
  renderDetailFiles("completedDraftFiles");
  renderDetailFiles("draftFiles");
  renderDetailFiles("attachmentFiles");
  renderDetailPeople("commenters");
  renderDetailPeople("ccUsers");
  document.getElementById("detailCommenterCount").textContent =
    `${state.commenters.length} người`;
  document.getElementById("detailCcCount").textContent =
    `${state.ccUsers.length} người`;
}

function mountSignDetailPanel(target) {
  const panel = document.querySelector(".sign-detail-panel");
  const host =
    target === "inbox"
      ? document.getElementById("signingInboxDetailHost")
      : document.getElementById("signDetailLayout");

  if (panel && host && panel.parentElement !== host) {
    host.appendChild(panel);
    requestAnimationFrame(drawSignHistorySegments);
  }
}

function showWorkflowList() {
  hydrateWorkflowListFromForm();

  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("signingInboxView").classList.add("screen-hidden");
  document.getElementById("listView").classList.remove("screen-hidden");
  setWorkflowMenuActive("listView", "all");
  window.scrollTo(0, 0);
}

function showCreateScreen() {
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("signingInboxView").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("appLayout").classList.remove("screen-hidden");
  setWorkflowMenuActive("appLayout", "create");
}

function showSigningInbox() {
  if (!isSignerRole()) {
    selectedPowerPersonFilter = "related-leader-signer";
    document.querySelectorAll("[data-power-person-filter]").forEach((item) => {
      item.value = selectedPowerPersonFilter;
    });
  }

  hydrateWorkflowListFromForm();
  renderSignDetailFiles();
  syncSigningListForRole();
  syncSigningInboxForRole();
  mountSignDetailPanel("inbox");
  syncSigningInboxColumnControls();
  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("signingInboxView").classList.remove("screen-hidden");
  setWorkflowMenuActive("signingInboxView", "signing");
  window.scrollTo(0, 0);
}

function configureSignCreateMode(mode) {
  const isEdit = mode === "edit";
  const isAdditional = mode === "create-additional";

  signCreateMode = mode;
  document.getElementById("signCreatePageTitle").textContent = isEdit
    ? "Chỉnh sửa: Trình ký văn bản"
    : "Tạo mới: Trình ký văn bản";
  document.getElementById("signSubmitIcon").textContent = isEdit
    ? "save"
    : "drive_file_move";
  document.getElementById("signSubmitLabel").textContent = isEdit
    ? "Lưu"
    : "Tạo trình ký";

  if (isAdditional) {
    document.getElementById("summary").value = "";
    document.getElementById("signNumber").value = "";
    document.getElementById("identifierRegion").value = "";
    updateSummaryCounter();
  }
}

function showSignCreateScreen(mode = "create") {
  configureSignCreateMode(mode);
  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("signingInboxView").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.remove("screen-hidden");
  setWorkflowMenuActive("signCreateView", "all");
  renderSigningFiles("main");
  window.scrollTo(0, 0);
}

function showSignEditScreen() {
  const activeCard = document.querySelector(".signing-card.active");
  const activeSummary = activeCard
    ?.querySelector(".signing-card-summary")
    ?.textContent.trim();

  if (activeSummary) {
    document.getElementById("summary").value = activeSummary;
    updateSummaryCounter();
  }

  showSignCreateScreen("edit");
}

function updateSigningListCount() {
  const cards = [...document.querySelectorAll(".signing-card")];
  const eligibleCards = isSignerRole()
    ? cards.filter((card) => card.dataset.status !== "draft")
    : cards;
  const cardCount = eligibleCards.length;
  const title = document.getElementById("signingListTitle");

  if (title) {
    title.textContent = `Danh sách trình ký · ${cardCount}`;
  }

  document
    .querySelectorAll("[data-signing-filter-count]")
    .forEach((count) => {
      const filterKey = count.dataset.signingFilterCount;
      count.textContent =
        filterKey === "all"
          ? cardCount
          : eligibleCards.filter((card) => card.dataset.status === filterKey)
              .length;
    });
}

function applySigningFilter(filterKey, shouldSyncSelection = true) {
  const cards = [...document.querySelectorAll(".signing-card")];
  const filters = document.querySelectorAll("[data-signing-filter]");

  filters.forEach((filter) => {
    filter.classList.toggle(
      "active",
      filter.dataset.signingFilter === filterKey
    );
  });

  cards.forEach((card) => {
    const hiddenForSignerRole =
      isSignerRole() && card.dataset.status === "draft";
    const hiddenForFilter =
      filterKey !== "all" && card.dataset.status !== filterKey;

    card.hidden = hiddenForSignerRole || hiddenForFilter;
  });

  const activeCard = cards.find((card) => card.classList.contains("active"));

  if (!activeCard?.hidden || !shouldSyncSelection) return;

  activeCard.classList.remove("active");

  const firstVisibleCard = cards.find((card) => !card.hidden);

  if (firstVisibleCard) {
    firstVisibleCard.classList.add("active");
    syncSignSummaryFromActiveCard();
  }
}

function syncSigningListForRole() {
  const draftFilter = document.querySelector(
    '[data-signing-filter="draft"]'
  );
  const activeFilter = document.querySelector(
    "[data-signing-filter].active"
  );
  let filterKey = activeFilter?.dataset.signingFilter || "all";

  if (draftFilter) {
    draftFilter.hidden = isSignerRole();
  }

  if (isSignerRole() && filterKey === "draft") {
    filterKey = "all";
  }

  updateSigningListCount();
  applySigningFilter(filterKey);
}

function findSigningCardByCode(code) {
  return [...document.querySelectorAll(".signing-card")].find(
    (card) => card.querySelector("strong")?.textContent.trim() === code
  );
}

const signingInboxStatusConfig = {
  "not-turn": {
    label: "Chưa đến lượt",
    tooltip: "Bước tuần tự phía trước chưa ký xong."
  },
  "needs-sign": {
    label: "Cần ký",
    tooltip: "Đã đến lượt và đang chờ người này thao tác."
  },
  signed: {
    label: "Đã ký",
    tooltip: "Người này đã ký số thành công."
  },
  "rejected-sign": {
    label: "Từ chối ký",
    tooltip: "Người này đã từ chối ký; văn bản được trả về Bản nháp."
  },
  transferred: {
    label: "Chuyển ký",
    tooltip: "Việc ký đã được chuyển cho người khác cùng phòng ban."
  },
  stopped: {
    label: "Đã dừng",
    tooltip: "Dòng đã dừng vì một Ban trong bước song song từ chối ký."
  }
};

function applySigningInboxFilters(filterKey) {
  const tasks = [
    ...document.querySelectorAll(".signing-inbox-table [data-signing-task]")
  ];
  const searchInput = document.getElementById("signingInboxSearch");
  const clearButton = document.getElementById("clearSigningInboxSearch");
  const emptyState = document.getElementById("signingInboxEmpty");
  const keyword = normalizeSearchKeyword(searchInput?.value.trim() || "");
  const activeFilter =
    filterKey ||
    document.querySelector("[data-signing-inbox-filter].active")?.dataset
      .signingInboxFilter ||
    "all";
  const matchingSearchTasks = tasks.filter((task) => {
    const code = task.dataset.signingCode || "";
    const title =
      task.querySelector(".signing-inbox-title")?.textContent.trim() || "";
    const fields =
      task.querySelector(".signing-inbox-card-fields")?.textContent.trim() ||
      "";

    return normalizeSearchKeyword(`${code} ${title} ${fields}`).includes(
      keyword
    );
  });

  tasks.forEach((task) => {
    const matchesSearch = matchingSearchTasks.includes(task);
    const matchesStatus =
      activeFilter === "all" || task.dataset.status === activeFilter;

    task.hidden = !matchesSearch || !matchesStatus;
  });

  document
    .querySelectorAll("[data-signing-inbox-filter-count]")
    .forEach((count) => {
      const status = count.dataset.signingInboxFilterCount;
      count.textContent = String(
        status === "all"
          ? matchingSearchTasks.length
          : matchingSearchTasks.filter((task) => task.dataset.status === status)
              .length
      );
    });

  const visibleCount = tasks.filter((task) => !task.hidden).length;
  const total = document.getElementById("signingInboxTotal");

  if (total) {
    total.textContent = String(matchingSearchTasks.length);
    total.setAttribute(
      "aria-label",
      `${matchingSearchTasks.length} văn bản trình ký`
    );
  }

  if (clearButton) {
    clearButton.hidden = !searchInput?.value;
  }

  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
  }
}

function setActiveSigningInboxStatus(status) {
  const activeTask = document.querySelector(
    ".signing-inbox-table [data-signing-task].active"
  );
  const activeCard = document.querySelector(".signing-card.active");

  if (!activeTask || !signingInboxStatusConfig[status]) return;

  [
    "departmentSignerState",
    "leaderSignerState",
    "primarySignerState"
  ].forEach((stateKey) => {
    if (activeCard?.dataset[stateKey]) {
      activeTask.dataset[stateKey] = activeCard.dataset[stateKey];
    }
  });

  activeTask.dataset.prototypeStatus = status;
  syncSigningInboxForRole();
}

function syncSigningInboxForRole() {
  const tasks = [
    ...document.querySelectorAll(".signing-inbox-table [data-signing-task]")
  ];
  const role =
    signerRoleFlow[selectedPowerPersonFilter] ||
    signerRoleFlow["related-department-signer"];
  tasks.forEach((task) => {
    const linkedCard = findSigningCardByCode(task.dataset.signingCode);

    initializeSigningFlowState(linkedCard);

    if (!task.dataset.prototypeStatus) {
      [
        "departmentSignerState",
        "leaderSignerState",
        "primarySignerState"
      ].forEach((stateKey) => {
        if (linkedCard?.dataset[stateKey]) {
          task.dataset[stateKey] = linkedCard.dataset[stateKey];
        }
      });
    }

    const state = task.dataset[role.stateKey] || "pending";
    const prerequisitesSigned = role.prerequisites.every(
      (stateKey) => task.dataset[stateKey] === "approved"
    );
    const derivedStatus =
      state === "approved"
        ? "signed"
        : state === "pending" && prerequisitesSigned
          ? "needs-sign"
          : "not-turn";
    const status = task.dataset.prototypeStatus || derivedStatus;
    const statusConfig =
      signingInboxStatusConfig[status] || signingInboxStatusConfig["not-turn"];
    const badge = task.querySelector("[data-signing-inbox-status]");

    task.dataset.status = status;

    if (badge) {
      badge.className = status;
      badge.textContent = statusConfig.label;
      badge.title = statusConfig.tooltip;
    }
  });

  const activeSigningCode = document
    .querySelector(".signing-card.active strong")
    ?.textContent.trim();

  tasks.forEach((task) => {
    task.classList.toggle(
      "active",
      task.dataset.signingCode === activeSigningCode
    );
  });

  const activeFilter = document.querySelector(
    "[data-signing-inbox-filter].active"
  );
  let filterKey = activeFilter?.dataset.signingInboxFilter || "all";

  if (
    filterKey !== "all" &&
    !tasks.some((task) => task.dataset.status === filterKey)
  ) {
    filterKey = "all";
  }

  document
    .querySelectorAll("[data-signing-inbox-filter]")
    .forEach((filter) => {
      filter.classList.toggle(
        "active",
        filter.dataset.signingInboxFilter === filterKey
      );
    });

  applySigningInboxFilters(filterKey);
}

function createAdditionalSigningCard() {
  const row = document.getElementById("signingCardRow");

  if (!row) return;

  const currentNumbers = [...row.querySelectorAll(".signing-card strong")]
    .map((item) => Number(item.textContent.trim().split("-").pop()))
    .filter(Number.isFinite);
  const nextNumber = Math.max(0, ...currentNumbers) + 1;
  const code = `TK-2026-${String(nextNumber).padStart(4, "0")}`;
  const summary =
    document.getElementById("summary").value.trim() ||
    "Trình ký bổ sung văn bản dự thảo";
  const card = document.createElement("button");

  row
    .querySelectorAll(".signing-card")
    .forEach((item) => item.classList.remove("active"));

  card.className = "signing-card active";
  card.type = "button";
  card.dataset.status = "draft";
  card.innerHTML = `
    <strong>${escapeHtml(code)}</strong>
    <span class="signing-card-summary">${escapeHtml(summary)}</span>
    <small>13/07/2026</small>
    <em class="draft">Bản nháp</em>
    <span class="signing-card-label is-empty" data-signing-label>-</span>
  `;
  row.prepend(card);
  row.scrollTop = 0;

  updateSigningListCount();
  applySigningFilter("all", false);
  syncSignSummaryFromActiveCard();
}

function showSignDetailScreen(menuContext = "all") {
  mountSignDetailPanel("standalone");
  hydrateWorkflowListFromForm();
  renderSignDetailFiles();
  syncSigningListForRole();

  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signingInboxView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.remove("screen-hidden");
  setWorkflowMenuActive("signDetailView", menuContext);
  window.scrollTo(0, 0);
}

function completeCreate() {
  showWorkflowList();
  showToast("Tạo mới quy trình góp ý thành công.");
}

function requestCreateConfirmation() {
  openConfirmModal({
    title: "Xác nhận tạo mới",
    message: "Bạn có muốn tạo mới quy trình góp ý không?",
    primaryText: "Đồng ý",
    secondaryText: "Hủy",
    primaryVariant: "primary",
    onConfirm: completeCreate
  });
}

function showFeedbackSentActions() {
  document.getElementById("draftDetailActions").classList.add("feedback-sent");
  showToast("Đã gửi góp ý.");
}

function requestSendFeedbackConfirmation() {
  openConfirmModal({
    title: "Xác nhận gửi góp ý",
    message: "Bạn có muốn gửi góp ý cho quy trình này không?",
    primaryText: "Đồng ý",
    secondaryText: "Hủy",
    primaryVariant: "primary",
    onConfirm: showFeedbackSentActions
  });
}

function requestLeaveConfirmation() {
  if (!hasUnsavedData()) {
    showWorkflowList();
    return;
  }

  openConfirmModal({
    title: "Cảnh báo dữ liệu chưa lưu",
    message:
      "Dữ liệu chưa được lưu. Bạn có chắc chắn muốn rời khỏi màn hình không?",
    primaryText: "Rời khỏi",
    secondaryText: "Ở lại",
    primaryVariant: "danger",
    onConfirm: () => {
      showWorkflowList();
      showToast("Đã rời khỏi màn hình tạo mới.");
    }
  });
}

function requestSignCancelConfirmation() {
  const returnsToSignDetail =
    signCreateMode === "edit" || signCreateMode === "create-additional";
  const isEdit = signCreateMode === "edit";

  openConfirmModal({
    title: isEdit ? "Xác nhận huỷ chỉnh sửa" : "Xác nhận huỷ",
    message: isEdit
      ? "Các thay đổi chưa được lưu. Bạn có chắc chắn muốn huỷ chỉnh sửa không?"
      : "Thông tin trình ký chưa được lưu. Bạn có chắc chắn muốn huỷ không?",
    primaryText: "Đồng ý",
    secondaryText: "Ở lại",
    primaryVariant: "danger",
    onConfirm: () => {
      if (returnsToSignDetail) {
        showSignDetailScreen();
      } else {
        showWorkflowList();
      }

      showToast(isEdit ? "Đã huỷ chỉnh sửa." : "Đã huỷ tạo trình ký.");
    }
  });
}

function requestSignSubmitConfirmation() {
  if (signCreateMode === "edit") {
    openConfirmModal({
      title: "Xác nhận lưu chỉnh sửa",
      message: "Bạn có muốn lưu các thay đổi của trình ký này không?",
      primaryText: "Đồng ý",
      secondaryText: "Huỷ",
      primaryVariant: "primary",
      onConfirm: () => {
        const activeCard = document.querySelector(".signing-card.active");
        const summary = document.getElementById("summary").value.trim();

        if (activeCard) {
          activeCard.dataset.edited = "true";

          if (summary) {
            activeCard.querySelector(".signing-card-summary").textContent = summary;
          }
        }

        showSignDetailScreen();
        showToast("Đã lưu chỉnh sửa trình ký.");
      }
    });
    return;
  }

  openConfirmModal({
    title: "Xác nhận tạo trình ký",
    message: "Bạn có muốn tạo trình ký văn bản không?",
    primaryText: "Đồng ý",
    secondaryText: "Hủy",
    primaryVariant: "primary",
    onConfirm: () => {
      if (signCreateMode === "create-additional") {
        createAdditionalSigningCard();
      }

      showSignDetailScreen();
      showToast("Đã tạo trình ký văn bản.");
    }
  });
}

document.getElementById("createForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateCreateForm()) return;

  requestCreateConfirmation();
});

document
  .getElementById("backButton")
  .addEventListener("click", requestLeaveConfirmation);

document
  .getElementById("cancelButton")
  .addEventListener("click", requestLeaveConfirmation);

document
  .getElementById("closeConfirmModal")
  .addEventListener("click", closeConfirmModal);

document
  .getElementById("confirmModalSecondary")
  .addEventListener("click", closeConfirmModal);

document
  .getElementById("confirmModalPrimary")
  .addEventListener("click", () => {
    const action = pendingConfirmAction;

    closeConfirmModal();

    if (action) action();
  });

document.addEventListener("click", (event) => {
  const menuItem = event.target.closest("[data-workflow-menu-action]");

  if (!menuItem) return;

  const action = menuItem.dataset.workflowMenuAction;

  if (action === "create") {
    showCreateScreen();
  } else if (action === "all") {
    showWorkflowList();
  } else if (action === "signing") {
    showSigningInbox();
  }
});

document
  .getElementById("signBackButton")
  .addEventListener("click", () => {
    if (signCreateMode === "edit" || signCreateMode === "create-additional") {
      showSignDetailScreen();
      return;
    }

    showWorkflowList();
  });

document
  .getElementById("signCancelButton")
  .addEventListener("click", requestSignCancelConfirmation);

document
  .getElementById("signSubmitButton")
  .addEventListener("click", requestSignSubmitConfirmation);

document
  .getElementById("closeCompletedDraftModal")
  .addEventListener("click", closeCompletedDraftModal);

document
  .getElementById("cancelCompletedDraftUpload")
  .addEventListener("click", closeCompletedDraftModal);

document
  .getElementById("confirmCompletedDraftUpload")
  .addEventListener("click", confirmCompletedDraftUpload);

document.querySelectorAll("[data-go-list]").forEach((item) => {
  item.addEventListener("click", showWorkflowList);
});

document.querySelectorAll("[data-open-related-draft]").forEach((button) => {
  button.addEventListener("click", () => {
    showWorkflowList();
    showToast("Đã mở dự thảo tương ứng.");
  });
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    copyWorkflowText(button.dataset.copyTarget);
  });
});

document.querySelectorAll("[data-share-target]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    shareWorkflowText(button.dataset.shareTarget);
  });
});

document.querySelectorAll("[data-expand-detail]").forEach((button) => {
  button.addEventListener("click", () => {
    const screen = button.closest(
      "#listView, #signDetailView, #signingInboxView"
    );
    const icon = button.querySelector(".material-symbols-outlined");

    if (!screen || !icon) return;

    const expanded = screen.classList.toggle("workflow-detail-expanded");

    if (screen.id === "signingInboxView" && expanded) {
      screen.classList.remove("inbox-detail-collapsed");
      syncSigningInboxColumnControls();
    }

    icon.textContent = expanded ? "close_fullscreen" : "open_in_full";
    button.setAttribute(
      "aria-label",
      expanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"
    );
  });
});

document
  .getElementById("signingInboxView")
  ?.addEventListener("click", (event) => {
    const menuToggle = event.target.closest("[data-toggle-inbox-menu]");
    const listToggle = event.target.closest("[data-toggle-inbox-list]");
    const detailToggle = event.target.closest("[data-toggle-inbox-detail]");

    if (menuToggle) {
      toggleSigningInboxColumn("menu");
    } else if (listToggle) {
      toggleSigningInboxColumn("list");
    } else if (detailToggle) {
      toggleSigningInboxColumn("detail");
    }
  });

document.querySelectorAll("[data-toggle-progress]").forEach((button) => {
  button.addEventListener("click", () => {
    const overview = button.closest("[data-workflow-overview]");
    const panel = button.closest(".draft-detail-panel");
    const separateProgress = panel?.querySelector("[data-workflow-progress]");
    const progressTarget = separateProgress || overview;
    const icon = button.querySelector(".material-symbols-outlined");

    if (!progressTarget || !icon) return;

    const hidden = progressTarget.classList.toggle("progress-hidden");
    button.classList.toggle("active", hidden);
    icon.textContent = hidden ? "visibility" : "timeline";
    button.setAttribute(
      "aria-label",
      hidden ? "Hiện tiến trình" : "Ẩn tiến trình"
    );
  });
});

document.querySelectorAll(".draft-card").forEach((card) => {
  card.addEventListener("click", () => {
    document
      .querySelectorAll(".draft-card")
      .forEach((item) => item.classList.remove("active"));

    card.classList.add("active");

    const title = card.querySelector(".draft-card-title")?.textContent.trim();

    if (title) {
      document.getElementById("detailDraftTitle").textContent = title;
      document.getElementById("readonlyTitle").textContent = title;
    }
  });
});

document.querySelectorAll(".detail-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const panel = tab.closest(".draft-detail-panel");
    const overview = panel?.querySelector("[data-workflow-overview]");
    const content = panel?.querySelector(".draft-detail-scroll");
    const separateProgress = panel?.querySelector("[data-workflow-progress]");
    const toggleProgressButton = overview?.querySelector("[data-toggle-progress]");
    const toggleProgressIcon = toggleProgressButton?.querySelector(
      ".material-symbols-outlined"
    );
    const isInfoTab = tab.dataset.detailTab === "info";

    if (!panel || !overview || !content) return;

    panel
      .querySelectorAll(".detail-tab")
      .forEach((item) => item.classList.remove("active"));

    tab.classList.add("active");

    if (panel.classList.contains("sign-detail-panel")) {
      content.classList.remove("detail-content-hidden");
      overview.classList.remove("tab-content-hidden");
      panel.querySelectorAll("[data-sign-detail-panel]").forEach((section) => {
        section.hidden =
          section.dataset.signDetailPanel !== tab.dataset.detailTab;
      });

      if (isInfoTab) {
        separateProgress?.classList.remove("progress-hidden");
        toggleProgressButton?.classList.remove("active");

        if (toggleProgressIcon) {
          toggleProgressIcon.textContent = "timeline";
        }

        toggleProgressButton?.setAttribute("aria-label", "Ẩn tiến trình");
        requestAnimationFrame(drawSignHistorySegments);
      }

      return;
    }

    overview.classList.toggle("tab-content-hidden", !isInfoTab);
    content.classList.toggle("detail-content-hidden", !isInfoTab);

    if (isInfoTab) {
      overview.classList.remove("progress-hidden");
      separateProgress?.classList.remove("progress-hidden");
      toggleProgressButton?.classList.remove("active");

      if (toggleProgressIcon) {
        toggleProgressIcon.textContent = "timeline";
      }

      toggleProgressButton?.setAttribute("aria-label", "Ẩn tiến trình");
    }
  });
});

document
  .querySelectorAll("[data-sign-history-iteration]")
  .forEach((iterationTab) => {
    iterationTab.addEventListener("click", () => {
      document
        .querySelectorAll("[data-sign-history-iteration]")
        .forEach((item) => {
          const isActive = item === iterationTab;
          item.classList.toggle("active", isActive);
          item.setAttribute("aria-selected", String(isActive));
        });

      const statusKey =
        document.querySelector(".signing-card.active")?.dataset.status ||
        "draft";
      renderSignApprovalTable(statusKey);
    });
  });

window.addEventListener("resize", () => {
  requestAnimationFrame(drawSignHistorySegments);
});

function normalizeSearchKeyword(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

document.querySelectorAll(".related-card").forEach((card) => {
  const badge = card.querySelector(".selected-badge");
  const searchInput = card.querySelector(".related-search input");
  const clearSearchButton = card.querySelector(".related-search-clear");
  const options = [...card.querySelectorAll(".related-option")];

  const updateBadge = () => {
    const checkedCount = options.filter((option) =>
      option.querySelector("input").checked
    ).length;

    badge.textContent = `${checkedCount} đã chọn`;
  };

  const filterOptions = () => {
    const keyword = normalizeSearchKeyword(searchInput.value.trim());

    options.forEach((option) => {
      option.hidden = !normalizeSearchKeyword(option.textContent).includes(keyword);
    });

    if (clearSearchButton) {
      clearSearchButton.hidden = !keyword;
    }
  };

  options.forEach((option) => {
    option.querySelector("input").addEventListener("change", updateBadge);
  });

  searchInput.addEventListener("input", filterOptions);
  clearSearchButton?.addEventListener("click", () => {
    searchInput.value = "";
    filterOptions();
    searchInput.focus();
  });
  updateBadge();
  filterOptions();
});

document
  .getElementById("sendFeedbackButton")
  .addEventListener("click", requestSendFeedbackConfirmation);

const detailMoreButton = document.getElementById("detailMoreButton");
const detailActionMenu = document.getElementById("detailActionMenu");
const stopFeedbackButton = document.getElementById("stopFeedbackButton");
const stopFeedbackMenu = document.getElementById("stopFeedbackMenu");
const signingCardRow = document.getElementById("signingCardRow");
const signingQuickFilters = document.getElementById("signingQuickFilters");
const signingInboxFilters = document.getElementById("signingInboxFilters");
const signingInboxTable = document.querySelector(".signing-inbox-table");
const signingInboxSearch = document.getElementById("signingInboxSearch");
const clearSigningInboxSearch = document.getElementById(
  "clearSigningInboxSearch"
);
const signDetailActions = document.getElementById("signDetailActions");

function closeDetailActionMenu() {
  detailActionMenu.classList.remove("open");
  detailMoreButton.setAttribute("aria-expanded", "false");
}

function closeSignExecuteMenu() {
  const menu = signDetailActions?.querySelector(".sign-execute-menu");
  const toggle = signDetailActions?.querySelector("[data-sign-menu-toggle]");

  menu?.classList.remove("open");
  toggle?.setAttribute("aria-expanded", "false");
}

function closeStopFeedbackMenu() {
  stopFeedbackMenu.classList.remove("open");
  stopFeedbackButton.setAttribute("aria-expanded", "false");
}

detailMoreButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const expanded = detailMoreButton.getAttribute("aria-expanded") === "true";

  closeStopFeedbackMenu();
  detailActionMenu.classList.toggle("open", !expanded);
  detailMoreButton.setAttribute("aria-expanded", String(!expanded));
});

detailActionMenu.addEventListener("click", (event) => {
  event.stopPropagation();
});

stopFeedbackButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const expanded = stopFeedbackButton.getAttribute("aria-expanded") === "true";

  closeDetailActionMenu();
  stopFeedbackMenu.classList.toggle("open", !expanded);
  stopFeedbackButton.setAttribute("aria-expanded", String(!expanded));
});

stopFeedbackMenu.addEventListener("click", (event) => {
  event.stopPropagation();

  const action = event.target.closest(".feedback-action-item");

  if (!action) return;

  if (action.dataset.action === "sign-create") {
    closeStopFeedbackMenu();
    openCompletedDraftModal();
    return;
  }

  showToast(`Đã chọn thao tác: ${action.textContent.trim()}`);
  closeStopFeedbackMenu();
});

function requestSigningStatusChange({ title, message, statusKey, successMessage }) {
  openConfirmModal({
    title,
    message,
    primaryText: "Đồng ý",
    secondaryText: "Huỷ",
    primaryVariant: statusKey ? "primary" : "danger",
    onConfirm: () => {
      if (statusKey) {
        updateActiveSigningStatus(statusKey);
      }

      showToast(successMessage);
    }
  });
}

function closeRelatedSignerActionModal() {
  signerActionModalMode = "";
  document.getElementById("relatedSignerActionModal").classList.remove("open");
}

function openRelatedSignerActionModal(mode) {
  const modalConfig = {
    approve: {
      title: "Xác nhận đồng ý",
      description: "Nhập nội dung ký trước khi xác nhận đồng ý văn bản.",
      label: "Nội dung",
      placeholder: "Nhập nội dung ký (không bắt buộc)",
      defaultValue: "Đồng ý",
      primaryVariant: "primary"
    },
    reject: {
      title: "Xác nhận Từ chối",
      description: "Vui lòng nhập lý do từ chối văn bản trình ký.",
      label: "Lý do từ chối *",
      placeholder: "Nhập lý do từ chối",
      defaultValue: "",
      primaryVariant: "primary"
    },
    transfer: {
      title: "Chuyển ký",
      description: "Chọn một lãnh đạo liên quan để tiếp nhận quyền ký.",
      primaryVariant: "primary"
    }
  };
  const config = modalConfig[mode];

  if (!config) return;

  signerActionModalMode = mode;

  const textField = document.getElementById("relatedSignerTextField");
  const transferField = document.getElementById("relatedSignerTransferField");
  const textarea = document.getElementById("relatedSignerContent");
  const transferContent = document.getElementById(
    "relatedSignerTransferContent"
  );
  const error = document.getElementById("relatedSignerActionError");
  const primaryButton = document.getElementById("confirmRelatedSignerAction");

  document.getElementById("relatedSignerActionTitle").textContent = config.title;
  document.getElementById("relatedSignerActionDescription").textContent =
    config.description;
  textField.hidden = mode === "transfer";
  transferField.hidden = mode !== "transfer";
  textarea.value = config.defaultValue || "";
  transferContent.value = "";
  textarea.placeholder = config.placeholder || "";
  document.getElementById("relatedSignerContentLabel").textContent =
    config.label || "";
  document
    .querySelectorAll('input[name="relatedSignerTransferPerson"]')
    .forEach((input) => {
      input.checked = false;
    });
  error.textContent = "";
  error.classList.remove("visible");
  primaryButton.disabled = mode === "transfer";
  primaryButton.className =
    `genco-button genco-button--${config.primaryVariant}`;
  document.getElementById("relatedSignerActionModal").classList.add("open");

  setTimeout(() => {
    if (mode === "transfer") {
      document
        .querySelector('input[name="relatedSignerTransferPerson"]')
        ?.focus();
    } else {
      textarea.focus();
    }
  }, 0);
}

function confirmRelatedSignerAction() {
  const textarea = document.getElementById("relatedSignerContent");
  const transferContent = document
    .getElementById("relatedSignerTransferContent")
    .value.trim();
  const error = document.getElementById("relatedSignerActionError");
  const selectedRecipient = document.querySelector(
    'input[name="relatedSignerTransferPerson"]:checked'
  );
  const content = textarea.value.trim();

  if (signerActionModalMode === "reject" && !content) {
    error.textContent = "Vui lòng nhập lý do từ chối.";
    error.classList.add("visible");
    textarea.focus();
    return;
  }

  if (signerActionModalMode === "transfer" && !selectedRecipient) {
    error.textContent = "Vui lòng chọn người nhận chuyển ký.";
    error.classList.add("visible");
    return;
  }

  const mode = signerActionModalMode;
  const { card, role } = activeSignerRoleState();
  closeRelatedSignerActionModal();

  if (!card || !role) return;

  if (mode === "approve") {
    card.dataset[role.stateKey] = "approved";
    card.dataset[role.decisionContentKey] = content;

    updateActiveSigningStatus(
      selectedPowerPersonFilter === "primary-signer" ? "signed" : "signing"
    );
    setActiveSigningInboxStatus("signed");
    showToast("Đã đồng ý và ký văn bản.");
    return;
  }

  if (mode === "reject") {
    card.dataset[role.stateKey] = "rejected";
    card.dataset[role.decisionContentKey] = content;
    updateActiveSigningStatus("rejected");
    setActiveSigningInboxStatus("rejected-sign");
    showToast("Đã từ chối văn bản.");
    return;
  }

  const recipient = selectedRecipient.value;

  card.dataset[role.stateKey] = "transferred";
  card.dataset[role.recipientKey] = recipient;
  card.dataset[role.transferContentKey] = transferContent;
  setActiveSigningInboxStatus("transferred");
  renderSignApprovalTable(card.dataset.status || "waiting");
  renderSignDetailActions(card.dataset.status || "waiting");
  showToast(`Đã chuyển ký cho ${recipient}.`);
}

function signedFilePermissionState() {
  const { card, role, state, recipient, prerequisitesSigned } =
    activeSignerRoleState();
  const documentStatus = card?.dataset.status || "draft";

  if (!role) {
    return {
      canAct: false,
      status: "view-only",
      label: "Chỉ xem",
      note: "Vai trò hiện tại không có quyền xử lý ký trên văn bản này.",
      state,
      recipient
    };
  }

  if (state === "approved") {
    return {
      canAct: false,
      status: "signed",
      label: "Đã ký",
      note: "Bạn đã hoàn thành ký văn bản này.",
      state,
      recipient
    };
  }

  if (state === "rejected") {
    return {
      canAct: false,
      status: "rejected",
      label: "Từ chối ký",
      note: "Bạn đã từ chối ký văn bản này.",
      state,
      recipient
    };
  }

  if (state === "transferred") {
    return {
      canAct: false,
      status: "transferred",
      label: "Đã chuyển ký",
      note: recipient
        ? `Quyền ký đã được chuyển cho ${recipient}.`
        : "Quyền ký đã được chuyển cho người xử lý khác.",
      state,
      recipient
    };
  }

  if (state === "stopped") {
    return {
      canAct: false,
      status: "stopped",
      label: "Đã dừng",
      note: "Dòng ký đã dừng do một bước song song trước đó bị từ chối.",
      state,
      recipient
    };
  }

  if (["signed", "rejected", "recalled"].includes(documentStatus)) {
    const stoppedByOtherSigner = documentStatus === "rejected";
    return {
      canAct: false,
      status: stoppedByOtherSigner ? "stopped" : documentStatus,
      label: stoppedByOtherSigner
        ? "Đã dừng"
        : documentStatus === "signed"
          ? "Đã ký"
          : "Đã thu hồi",
      note: stoppedByOtherSigner
        ? "Văn bản đã bị từ chối ở một bước ký khác."
        : "Văn bản đã kết thúc xử lý và chỉ còn quyền xem.",
      state,
      recipient
    };
  }

  if (state === "pending" && prerequisitesSigned) {
    return {
      canAct: true,
      status: "needs-sign",
      label: "Cần ký",
      note: "Đã đến lượt bạn xử lý. Vui lòng kiểm tra nội dung trước khi quyết định.",
      state,
      recipient
    };
  }

  return {
    canAct: false,
    status: "not-turn",
    label: "Chưa đến lượt",
    note: "Bạn có thể xem file; hành động ký sẽ mở khi các bước trước hoàn tất.",
    state,
    recipient
  };
}

function renderSignedFilePermission() {
  const permission = signedFilePermissionState();
  const activeCard = document.querySelector(".signing-card.active");
  const code = activeCard?.querySelector("strong")?.textContent.trim() || "--";
  const badge = document.getElementById("signedFilePermissionBadge");
  const note = document.getElementById("signedFilePermissionNote");
  const transferNote = document.getElementById("signedFileTransferNote");
  const footerHint = document.getElementById("signedFileFooterHint");
  const approveButton = document.getElementById("signedFileApproveAction");
  const rejectButton = document.getElementById("signedFileRejectAction");

  badge.textContent = permission.label;
  badge.className = `signed-file-permission-badge ${permission.status}`;
  note.textContent = permission.note;
  footerHint.textContent = permission.canAct
    ? "Kiểm tra kỹ nội dung trước khi thực hiện ký."
    : permission.note;
  approveButton.hidden = !permission.canAct;
  rejectButton.hidden = !permission.canAct;
  document.getElementById("signedFileSigningCode").textContent = code;

  transferNote.hidden = permission.status !== "transferred";
  transferNote.textContent =
    permission.status === "transferred" ? permission.note : "";
}

function openSignedFileModal() {
  renderSignedFilePermission();
  document.getElementById("signedFileModal").classList.add("open");
}

function closeSignedFileModal() {
  document.getElementById("signedFileModal").classList.remove("open");
}

function openSignedFileDecision(mode) {
  const permission = signedFilePermissionState();

  if (!permission.canAct) {
    renderSignedFilePermission();
    showToast("Bạn không có quyền xử lý ký ở trạng thái hiện tại.", "error");
    return;
  }

  closeSignedFileModal();
  openRelatedSignerActionModal(mode);
}

function openSignContentModal(index, trigger) {
  const person = signApprovalPeople[index];
  const content = trigger?.dataset.signHistoryContent || person?.content;

  if (!person || !content) return;

  const status = trigger?.dataset.signHistoryStatus || "";
  const isRejected = status === "Từ chối ký";

  document.getElementById("signContentModalTitle").textContent = isRejected
    ? "Nội dung từ chối"
    : "Nội dung xử lý";
  document.getElementById("signContentModalLabel").textContent = isRejected
    ? "Lý do từ chối"
    : "Nội dung xử lý";
  document.getElementById("signContentModalAvatar").textContent = initials(
    person.name
  );
  document.getElementById("signContentModalPerson").textContent = person.name;
  document.getElementById("signContentModalMeta").textContent =
    `${person.role} · ${person.unit}`;
  document.getElementById("signContentModalText").textContent = content;
  document.getElementById("signContentModal").classList.add("open");
}

function closeSignContentModal() {
  document.getElementById("signContentModal").classList.remove("open");
}

document
  .getElementById("signHistoryTimeline")
  ?.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-sign-content-index]");

    if (!viewButton) return;

    openSignContentModal(
      Number(viewButton.dataset.signContentIndex),
      viewButton
    );
  });

document
  .getElementById("closeSignContentModal")
  .addEventListener("click", closeSignContentModal);

document
  .getElementById("dismissSignContentModal")
  .addEventListener("click", closeSignContentModal);

document
  .getElementById("closeRelatedSignerActionModal")
  .addEventListener("click", closeRelatedSignerActionModal);

document
  .getElementById("dismissRelatedSignerAction")
  .addEventListener("click", closeRelatedSignerActionModal);

document
  .getElementById("confirmRelatedSignerAction")
  .addEventListener("click", confirmRelatedSignerAction);

document
  .querySelectorAll('input[name="relatedSignerTransferPerson"]')
  .forEach((input) => {
    input.addEventListener("change", () => {
      document.getElementById("confirmRelatedSignerAction").disabled = false;
      document
        .getElementById("relatedSignerActionError")
        .classList.remove("visible");
    });
  });

document
  .getElementById("relatedSignerContent")
  .addEventListener("input", () => {
    document
      .getElementById("relatedSignerActionError")
      .classList.remove("visible");
  });

document
  .getElementById("closeSignedFileModal")
  .addEventListener("click", closeSignedFileModal);

document
  .getElementById("dismissSignedFileModal")
  .addEventListener("click", closeSignedFileModal);

document
  .getElementById("signedFileRejectAction")
  .addEventListener("click", () => openSignedFileDecision("reject"));

document
  .getElementById("signedFileApproveAction")
  .addEventListener("click", () => openSignedFileDecision("approve"));

signDetailActions?.addEventListener("click", (event) => {
  event.stopPropagation();

  const relatedSignerAction = event.target.closest(
    "[data-related-signer-action]"
  );

  if (relatedSignerAction) {
    const action = relatedSignerAction.dataset.relatedSignerAction;

    if (action === "view-signed-file") {
      openSignedFileModal();
    } else {
      openRelatedSignerActionModal(action);
    }

    return;
  }

  const menuToggle = event.target.closest("[data-sign-menu-toggle]");

  if (menuToggle) {
    const menu = signDetailActions.querySelector(".sign-execute-menu");
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";

    menu?.classList.toggle("open", !expanded);
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    return;
  }

  const button = event.target.closest("[data-sign-action]");

  if (!button) return;

  const action = button.dataset.signAction;
  closeSignExecuteMenu();

  if (action === "edit") {
    showSignEditScreen();
    return;
  }

  if (action === "add-new") {
    showSignCreateScreen("create-additional");
    return;
  }

  if (action === "submit" || action === "resubmit") {
    requestSigningStatusChange({
      title: action === "submit" ? "Xác nhận trình ký" : "Xác nhận trình ký lại",
      message:
        action === "submit"
          ? "Bạn có muốn trình văn bản này để bắt đầu quy trình ký không?"
          : "Bạn có muốn trình ký lại văn bản này không?",
      statusKey: "waiting",
      successMessage: action === "submit" ? "Đã trình ký văn bản." : "Đã trình ký lại văn bản."
    });
    return;
  }

  if (action === "recall") {
    requestSigningStatusChange({
      title: "Xác nhận thu hồi",
      message: "Bạn có muốn thu hồi trình ký đang chờ ký không?",
      statusKey: "recalled",
      successMessage: "Đã thu hồi trình ký."
    });
    return;
  }

  if (action === "cancel-sign") {
    requestSigningStatusChange({
      title: "Xác nhận huỷ trình ký",
      message: "Bạn có chắc chắn muốn huỷ trình ký này không?",
      successMessage: "Đã huỷ trình ký."
    });
    return;
  }

  if (action === "cancel-draft") {
    openConfirmModal({
      title: "Xác nhận huỷ dự thảo",
      message: "Bạn có chắc chắn muốn huỷ hồ sơ dự thảo này không?",
      primaryText: "Đồng ý",
      secondaryText: "Huỷ",
      primaryVariant: "danger",
      onConfirm: () => {
        showWorkflowList();
        showToast("Đã huỷ hồ sơ dự thảo.");
      }
    });
    return;
  }

  if (action === "complete") {
    openConfirmModal({
      title: "Xác nhận hoàn thành",
      message: "Bạn có muốn hoàn thành quy trình dự thảo này không?",
      primaryText: "Đồng ý",
      secondaryText: "Huỷ",
      primaryVariant: "primary",
      onConfirm: () => {
        document
          .querySelectorAll('#signDetailView .workflow-step[data-step="complete"]')
          .forEach((step) => {
            step.classList.remove("pending");
            step.classList.add("completed");
          });
        showToast("Đã hoàn thành quy trình.");
      }
    });
  }
});

signingQuickFilters?.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-signing-filter]");

  if (!filter || !signingQuickFilters.contains(filter)) return;

  applySigningFilter(filter.dataset.signingFilter);
});

signingInboxFilters?.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-signing-inbox-filter]");

  if (!filter || !signingInboxFilters.contains(filter)) return;

  const filterKey = filter.dataset.signingInboxFilter;

  signingInboxFilters
    .querySelectorAll("[data-signing-inbox-filter]")
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.signingInboxFilter === filterKey
      );
    });

  applySigningInboxFilters(filterKey);
});

signingInboxSearch?.addEventListener("input", () => {
  applySigningInboxFilters();
});

clearSigningInboxSearch?.addEventListener("click", () => {
  signingInboxSearch.value = "";
  applySigningInboxFilters();
  signingInboxSearch.focus();
});

document.getElementById("sendSignDiscussion")?.addEventListener("click", () => {
  const input = document.getElementById("signDiscussionInput");
  const messages = document.getElementById("signDiscussionMessages");
  const content = input?.value.trim();

  if (!input || !messages || !content) {
    input?.focus();
    return;
  }

  const message = document.createElement("article");
  const timestamp = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  message.className = "sign-message is-current-user";
  message.innerHTML = `
    <span class="sign-message-avatar">NTH</span>
    <div>
      <header>
        <strong>Nguyễn Thị Thu Hà</strong>
        <time>${escapeHtml(timestamp)}</time>
      </header>
      <p>${escapeHtml(content)}</p>
    </div>
  `;
  messages.appendChild(message);
  input.value = "";
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

signingInboxTable?.addEventListener("click", (event) => {
  const task = event.target.closest("[data-signing-task]");

  if (!task || !signingInboxTable.contains(task)) return;

  const targetCard = findSigningCardByCode(task.dataset.signingCode);

  if (targetCard) {
    document
      .querySelectorAll(".signing-card")
      .forEach((card) => card.classList.remove("active"));

    targetCard.classList.add("active");
    targetCard.dataset.departmentSignerState =
      task.dataset.departmentSignerState;
    targetCard.dataset.leaderSignerState = task.dataset.leaderSignerState;
    targetCard.dataset.primarySignerState = task.dataset.primarySignerState;
    targetCard.dataset.signingFlowInitialized = "true";

    const groupStates = [
      task.dataset.departmentSignerState,
      task.dataset.leaderSignerState,
      task.dataset.primarySignerState
    ];
    const documentStatusByTicketStatus = {
      signed: "signed",
      "rejected-sign": "rejected",
      transferred: "signing",
      stopped: "rejected",
      "needs-sign": "waiting",
      "not-turn": "waiting"
    };
    const overallStatus =
      documentStatusByTicketStatus[task.dataset.status] ||
      (groupStates.every((state) => state === "approved")
        ? "signed"
        : groupStates.some((state) => state === "approved")
          ? "signing"
          : "waiting");
    targetCard.dataset.status = overallStatus;
    targetCard.querySelector(".signing-card-summary").textContent = task
      .querySelector(".signing-inbox-title")
      .textContent.trim();
    applySigningCardPresentation(targetCard, overallStatus);

    syncSignSummaryFromActiveCard();
    renderSignDetailFiles();
    syncSigningInboxForRole();

    const detailScroll = document.querySelector(
      "#signingInboxDetailHost .sign-detail-scroll"
    );

    if (detailScroll) {
      detailScroll.scrollTop = 0;
    }

    if (window.innerWidth <= 640) {
      document
        .getElementById("signingInboxDetailHost")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

signingCardRow?.addEventListener("click", (event) => {
  const card = event.target.closest(".signing-card");

  if (!card || !signingCardRow.contains(card)) return;

  document
    .querySelectorAll(".signing-card")
    .forEach((item) => item.classList.remove("active"));

  card.classList.add("active");
  syncSignSummaryFromActiveCard();
});

document.addEventListener("click", () => {
  closeDetailActionMenu();
  closeStopFeedbackMenu();
  closeSignExecuteMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDetailActionMenu();
    closeStopFeedbackMenu();
    closeSignExecuteMenu();
    closeCompletedDraftModal();
    closeSignContentModal();
  }
});

document
  .querySelectorAll(".workflow-step[data-step]")
  .forEach((step) => {
    const handleStepNavigation = () => {
      if (step.dataset.step === "draft") {
        showWorkflowList();
        return;
      }

      if (
        step.dataset.step === "sign" &&
        !step.classList.contains("pending")
      ) {
        showSignDetailScreen();
        return;
      }

      if (
        step.dataset.step === "complete" &&
        step.classList.contains("completed")
      ) {
        showToast("Hiển thị màn hoàn thành.");
      }
    };

    step.addEventListener("click", handleStepNavigation);
    step.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleStepNavigation();
      }
    });
  });

document
  .querySelectorAll(".modal-backdrop")
  .forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        if (backdrop.id === "confirmModal") {
          closeConfirmModal();
        } else if (backdrop.id === "completedDraftModal") {
          closeCompletedDraftModal();
        } else {
          backdrop.classList.remove("open");
        }
      }
    });
  });

renderFiles("draftFiles");
renderFiles("attachmentFiles");
renderDetailFiles("completedDraftFiles");
renderDetailFiles("draftFiles");
renderDetailFiles("attachmentFiles");
renderSigningFiles("main");
renderPeople("commenters");
renderPeople("ccUsers");
updateSigningListCount();
