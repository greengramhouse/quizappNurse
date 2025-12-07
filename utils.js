const createDropdown = (options, selectId, defaultText) => {
  const dropdown = document.getElementById(selectId);
  
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    dropdown.appendChild(opt);
    return dropdown;
  });
}

const pageChange = (...pages) => {
  // ซ่อนหรือแสดง elements ตามหน้าที่ระบุ
  const allSections = document.querySelectorAll("section");
  allSections.forEach((section) => {
    if (pages.includes(section.id)) {
      section.style.display = "flex";
      // ถ้าเข้าหน้า result-page ให้เริ่มต้นข้อมูล
      if (section.id === "result-page") {
        setTimeout(() => {
          if (typeof initResultPage === 'function') {
            initResultPage();
          }
        }, 100);
      }
    } else {
      section.style.display = "none";
    }
  });
};