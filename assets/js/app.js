const cloneData = (value) => JSON.parse(JSON.stringify(value));

const state = cloneData(window.GENCO_INITIAL_STATE);
const orgUsers = cloneData(window.GENCO_ORG_USERS);
const fileRules = cloneData(window.GENCO_FILE_RULES);
const detailDocuments = cloneData(window.GENCO_DETAIL_DOCUMENTS);
detailDocuments.completedDraftFiles = detailDocuments.completedDraftFiles || [];

const signingFiles = {
  main: [
    {
      name: "To trinh trinh de xuat mua thiet bi CNTT.docx",
      size: 248 * 1024,
      role: "main"
    },
    {
      name: "UQ dong chi Le Minh mua thiet bi CNTT.docx",
      size: 182 * 1024,
      role: "attachment"
    },
    {
      name: "Du thao Cong van phe duyet chu truong mua sam thiet bi CNTT.docx",
      size: 316 * 1024,
      role: "attachment"
    },
    {
      name: "Du thao To trinh thong qua ke hoach lua chon nha thau.docx",
      size: 274 * 1024,
      role: "attachment"
    },
    {
      name: "Du thao Quyet dinh thanh lap to tham dinh ho so mua sam.docx",
      size: 198 * 1024,
      role: "attachment"
    }
  ]
};

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
      const hasCompletedDraftTag =
        file.completedDraft || index === 3 || index === 4;

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

  const files = signingFiles.main.slice(0, 5);

  if (count) {
    count.textContent = String(files.length);
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
    name: "Ban Kinh doanh - Thị trường điện",
    content:
      "Đã kiểm tra nội dung nghiệp vụ, thống nhất với dự thảo và đề nghị tiếp tục trình cấp có thẩm quyền phê duyệt."
  },
  {
    name: "Ban Tài chính - Kế toán",
    content:
      "Đã rà soát các nội dung tài chính liên quan, số liệu và nguồn kinh phí phù hợp với hồ sơ trình ký."
  },
  {
    name: "TV. HĐQT Nguyễn Minh Khoa",
    content:
      "Thống nhất nội dung văn bản và đề nghị đơn vị chủ trì hoàn thiện thể thức trước khi phát hành."
  },
  {
    name: "TGĐ. Lê Văn Danh",
    content:
      "Đồng ý phê duyệt văn bản theo nội dung trình, giao Ban Pháp chế phối hợp triển khai các bước tiếp theo."
  }
];

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

function approvalStateFor(statusKey, index) {
  if (statusKey === "signed") {
    return { label: "Đã ký", className: "green" };
  }

  if (statusKey === "signing" && index === 0) {
    return { label: "Đã ký", className: "green" };
  }

  if (statusKey === "rejected" && index === 1) {
    return { label: "Từ chối", className: "red" };
  }

  return { label: "Chưa ký", className: "" };
}

function renderSignApprovalTable(statusKey) {
  const container = document.getElementById("signApprovalTable");

  if (!container) return;

  const isDraft = statusKey === "draft";
  container.classList.toggle("draft", isDraft);
  container.innerHTML = `
    <div class="sign-approval-head">
      <span>TT</span>
      <span>Lãnh đạo phê duyệt</span>
      ${isDraft ? "" : "<span>Nội dung</span><span>Trạng thái</span>"}
    </div>
    ${signApprovalPeople
      .map((person, index) => {
        const approvalState = approvalStateFor(statusKey, index);
        const isSigned = approvalState.label === "Đã ký";

        return `
          <div class="sign-approval-row">
            <span>${index + 1}</span>
            <strong>${escapeHtml(person.name)}</strong>
            ${
              isDraft
                ? ""
                : `<div class="sign-approval-content">
                     ${
                       isSigned
                         ? `<span title="${escapeHtml(person.content)}">${escapeHtml(person.content)}</span>
                            <button
                              class="sign-approval-view"
                              type="button"
                              data-sign-content-index="${index}"
                              title="Xem nội dung"
                              aria-label="Xem nội dung ký của ${escapeHtml(person.name)}"
                            >
                              <span class="material-symbols-outlined">visibility</span>
                            </button>`
                         : '<span class="sign-approval-empty">-</span>'
                     }
                   </div>
                   <em class="${approvalState.className}">${approvalState.label}</em>`
            }
          </div>
        `;
      })
      .join("")}
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
  const summary = activeCard?.querySelector("span")?.textContent.trim();
  const code = activeCard?.querySelector("strong")?.textContent.trim();
  const statusKey = activeCard?.dataset.status || "draft";
  const statusConfig = signingStatusConfig[statusKey] || signingStatusConfig.draft;
  const summaryTarget = document.getElementById("signSummaryText");
  const codeTarget = document.getElementById("signDetailCodeValue");
  const statusTarget = document.getElementById("signDetailStatus");

  if (summary && summaryTarget) {
    summaryTarget.textContent = summary;
  }

  if (code && codeTarget) {
    codeTarget.textContent = code;
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
  const badge = activeCard?.querySelector("em");

  if (!activeCard || !statusConfig || !badge) return;

  activeCard.dataset.status = statusKey;
  badge.textContent = statusConfig.label;
  badge.className = statusConfig.cardClass;
  syncSignSummaryFromActiveCard();
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

function showWorkflowList() {
  hydrateWorkflowListFromForm();

  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("listView").classList.remove("screen-hidden");
  window.scrollTo(0, 0);
}

function showCreateScreen() {
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("appLayout").classList.remove("screen-hidden");
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
  document.getElementById("signCreateView").classList.remove("screen-hidden");
  renderSigningFiles("main");
  window.scrollTo(0, 0);
}

function showSignEditScreen() {
  const activeCard = document.querySelector(".signing-card.active");
  const activeSummary = activeCard?.querySelector("span")?.textContent.trim();

  if (activeSummary) {
    document.getElementById("summary").value = activeSummary;
    updateSummaryCounter();
  }

  showSignCreateScreen("edit");
}

function updateSigningListCount() {
  const cardCount = document.querySelectorAll(".signing-card").length;
  const title = document.getElementById("signingListTitle");

  if (title) {
    title.textContent = `Có ${cardCount} văn bản trình ký`;
  }
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
    <span>${escapeHtml(summary)}</span>
    <small>13/07/2026</small>
    <em class="draft">Bản nháp</em>
  `;
  row.prepend(card);
  row.scrollLeft = 0;
  document.querySelector(".signing-list-card")?.classList.remove("show-all");

  const viewAllButton = document.getElementById("signingViewAllButton");

  if (viewAllButton) {
    viewAllButton.textContent = "Xem tất cả";
  }

  updateSigningListCount();
  syncSignSummaryFromActiveCard();
}

function showSignDetailScreen() {
  hydrateWorkflowListFromForm();
  renderSignDetailFiles();

  document.getElementById("appLayout").classList.add("screen-hidden");
  document.getElementById("listView").classList.add("screen-hidden");
  document.getElementById("signCreateView").classList.add("screen-hidden");
  document.getElementById("signDetailView").classList.remove("screen-hidden");
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
            activeCard.querySelector("span").textContent = summary;
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

document
  .getElementById("listCreateProcessButton")
  .addEventListener("click", showCreateScreen);

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
    const screen = button.closest("#listView, #signDetailView");
    const icon = button.querySelector(".material-symbols-outlined");

    if (!screen || !icon) return;

    const expanded = screen.classList.toggle("workflow-detail-expanded");
    icon.textContent = expanded ? "close_fullscreen" : "open_in_full";
    button.setAttribute(
      "aria-label",
      expanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"
    );
  });
});

document.querySelectorAll("[data-toggle-progress]").forEach((button) => {
  button.addEventListener("click", () => {
    const overview = button.closest("[data-workflow-overview]");
    const icon = button.querySelector(".material-symbols-outlined");

    if (!overview || !icon) return;

    const hidden = overview.classList.toggle("progress-hidden");
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
    overview.classList.toggle("tab-content-hidden", !isInfoTab);
    content.classList.toggle("detail-content-hidden", !isInfoTab);

    if (isInfoTab) {
      overview.classList.remove("progress-hidden");

      if (toggleProgressIcon) {
        toggleProgressIcon.textContent = "timeline";
      }

      toggleProgressButton?.setAttribute("aria-label", "Ẩn tiến trình");
    }
  });
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
const signingListCard = document.querySelector(".signing-list-card");
const signingViewAllButton = document.getElementById("signingViewAllButton");
const signingSlidePrev = document.getElementById("signingSlidePrev");
const signingSlideNext = document.getElementById("signingSlideNext");
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

function openSignContentModal(index) {
  const content = signApprovalPeople[index]?.content;

  if (!content) return;

  document.getElementById("signContentModalText").textContent = content;
  document.getElementById("signContentModal").classList.add("open");
}

function closeSignContentModal() {
  document.getElementById("signContentModal").classList.remove("open");
}

document
  .getElementById("signApprovalTable")
  .addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-sign-content-index]");

    if (!viewButton) return;

    openSignContentModal(Number(viewButton.dataset.signContentIndex));
  });

document
  .getElementById("closeSignContentModal")
  .addEventListener("click", closeSignContentModal);

document
  .getElementById("dismissSignContentModal")
  .addEventListener("click", closeSignContentModal);

signDetailActions?.addEventListener("click", (event) => {
  event.stopPropagation();

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

function scrollSigningCards(direction) {
  if (!signingCardRow) return;

  signingCardRow.scrollBy({
    left: direction * Math.max(260, signingCardRow.clientWidth * 0.75),
    behavior: "smooth"
  });
}

signingSlidePrev?.addEventListener("click", () => scrollSigningCards(-1));
signingSlideNext?.addEventListener("click", () => scrollSigningCards(1));

signingViewAllButton?.addEventListener("click", () => {
  if (!signingListCard) return;

  const expanded = signingListCard.classList.toggle("show-all");
  signingViewAllButton.textContent = expanded ? "Thu gọn" : "Xem tất cả";
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
