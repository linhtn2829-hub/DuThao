/* Mock data for the GENCO prototype. Edit this file to change demo users, default rows, and validation limits. */
window.GENCO_INITIAL_STATE = {
      assigner: {
        fullName: "Nguyễn Minh Anh",
        position: "Chuyên viên chính",
        department: "Ban Pháp chế",
        email: "nguyen.minh.anh@genco3.vn"
      },
      draftFiles: [],
      attachmentFiles: [],
      peopleTarget: "commenters",
      selectedPersonKey: "",
      commenters: [
        {
          id: "USR-001",
          fullName: "Nguyễn Văn An",
          position: "Trưởng ban",
          department: "Ban Pháp chế",
          feedbackStatus: "done",
          feedbackTime: "12/06/2025 10:30",
          feedbackContent:
            "Đề nghị rà soát lại Điều 3 về phạm vi áp dụng. Cần bổ sung căn cứ pháp lý và làm rõ trách nhiệm phối hợp giữa các đơn vị.",
          feedbackFiles: [
            {
              name: "Gop_y_Ban_Phap_che.docx",
              size: "1.2 MB",
              extension: "docx"
            },
            {
              name: "Tai_lieu_tham_chieu.pdf",
              size: "845 KB",
              extension: "pdf"
            }
          ]
        },
        {
          id: "USR-002",
          fullName: "Trần Quốc Huy",
          position: "Chuyên viên pháp lý",
          department: "Ban Pháp chế",
          feedbackStatus: "pending",
          feedbackTime: "",
          feedbackContent: "",
          feedbackFiles: []
        },
        {
          id: "USR-003",
          fullName: "Đỗ Minh Khôi",
          position: "Chuyên viên chính",
          department: "Ban Pháp chế",
          feedbackStatus: "done",
          feedbackTime: "13/06/2025 14:15",
          feedbackContent:
            "Đề nghị bổ sung thời hạn phối hợp xử lý giữa các đơn vị và thống nhất thuật ngữ trong toàn bộ dự thảo.",
          feedbackFiles: [
            {
              name: "Y_kien_bo_sung.docx",
              size: "720 KB",
              extension: "docx"
            }
          ]
        }
      ],
      ccUsers: [
        {
          id: "USR-004",
          fullName: "Lê Thu Hương",
          position: "Chánh Văn phòng",
          department: "Văn phòng Công ty",
          feedbackStatus: "done",
          feedbackTime: "12/06/2025 09:10",
          feedbackContent:
            "Thống nhất với nội dung dự thảo. Đề nghị cập nhật lại tên đơn vị tại phần nơi nhận.",
          feedbackFiles: [
            {
              name: "Van_phong_gop_y.docx",
              size: "638 KB",
              extension: "docx"
            }
          ]
        },
        {
          id: "USR-005",
          fullName: "Hoàng Ngọc Anh",
          position: "Phó Chánh Văn phòng",
          department: "Văn phòng Công ty",
          feedbackStatus: "pending",
          feedbackTime: "",
          feedbackContent: "",
          feedbackFiles: []
        }
      ]
    };

window.GENCO_ORG_USERS = [
      {
        id: "USR-006",
        fullName: "Nguyễn Hoàng Mai",
        position: "Chuyên viên chính",
        department: "Ban Nhân sự",
        active: true
      },
      {
        id: "USR-007",
        fullName: "Vũ Hải Nam",
        position: "Kế toán trưởng",
        department: "Ban Tài chính Kế toán",
        active: true
      },
      {
        id: "USR-008",
        fullName: "Bùi Thanh Tùng",
        position: "Chuyên viên",
        department: "Ban Quản trị rủi ro",
        active: false
      }
    ];

window.GENCO_DETAIL_DOCUMENTS = {
      draftFiles: [
        {
          name: "Du_thao_quy_trinh_gop_y_cac_Ban_VP_lan_1.docx",
          size: 924 * 1024
        },
        {
          name: "Du_thao_quy_trinh_gop_y_cac_Ban_VP_lan_2_cap_nhat_noi_dung.docx",
          size: 1180 * 1024
        }
      ],
      attachmentFiles: [
        {
          name: "Bang_tong_hop_y_kien_gop_y_du_thao.xlsx",
          size: 486 * 1024
        },
        {
          name: "Tai_lieu_trinh_bay_noi_dung_du_thao.pptx",
          size: 2150 * 1024
        },
        {
          name: "Can_cu_phap_ly_va_quy_dinh_lien_quan.pdf",
          size: 1320 * 1024
        },
        {
          name: "Phu_luc_danh_sach_don_vi_phoi_hop.docx",
          size: 768 * 1024
        },
        {
          name: "Bang_phan_cong_theo_doi_tien_do.xlsx",
          size: 354 * 1024
        }
      ]
    };

window.GENCO_FILE_RULES = {
      draftFiles: {
        extensions: ["docx"],
        maxFiles: 50,
        maxSize: 50 * 1024 * 1024,
        label: "Văn bản dự thảo",
        messages: {
          invalidExtension: "Văn bản dự thảo chỉ hỗ trợ định dạng .docx.",
          maxFiles: "Văn bản dự thảo không được vượt quá 50 file.",
          maxSize: "Dung lượng mỗi file Văn bản dự thảo không được vượt quá 50MB."
        }
      },
      attachmentFiles: {
        extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf"],
        maxFiles: 50,
        maxSize: 50 * 1024 * 1024,
        label: "Văn bản đính kèm",
        messages: {
          invalidExtension:
            "Định dạng file không được hỗ trợ. Hệ thống chỉ hỗ trợ Word, Excel, PowerPoint, PDF.",
          maxFiles: "Văn bản đính kèm không được vượt quá 50 file.",
          maxSize: "Dung lượng mỗi file Văn bản đính kèm không được vượt quá 50MB."
        }
      }
    };
