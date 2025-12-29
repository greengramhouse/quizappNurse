/* -------------------------
  Global app state
--------------------------*/
let setsData = []; // เก็บชุดคำถามทั้งหมดที่โหลดมาจาก GAS
let currentSetIndex = null; // ดัชนีของชุดคำถามที่ผู้ใช้เลือก
let currentQuestionIndex = 0; // ดัชนีของคำถามปัจจุบันในชุดคำถามที่เลือก
let userAnswers = []; // เก็บคำตอบของผู้ใช้
let passedSets = new Set(); // เก็บชุดที่ผ่านแล้ว (คะแนน >= 50%)
let submittedSets = new Set(); // เก็บชุดที่บันทึกไปแล้ว (เพื่อหลีกเลี่ยงการส่งซ้ำ)
const LIFF_ID = "2006372130-PYKdNb1r"; // LINE LIFF ID
let userDisplayName = "";
let imaageUrl = "";

// ⚙️ การตั้งค่า
const ALLOW_RESUBMIT = true; // ตั้ง true เพื่ออนุญาตการส่งซ้ำ, false เพื่อป้องกันการส่งซ้ำ
let userId = ""; // สร้าง userId สำหรับผู้ใช้แต่ละคน
// ปุ่มก่อนหน้าและถัดไป
const nextBtn = document.getElementById("next-btn");
const prevBtn = document.getElementById("prev-btn");
const startQuizBtn = document.getElementById("start-quiz-btn");

/* ---------- initial setup ---------- */
window.addEventListener("load", async () => {
  // ✅ เริ่มต้น LIFF
  await initializeLIFF();
  await loadQuestions();

  // เมื่อเปลี่ยนชุดคำถาม ให้ซ่อนคำถาม/คำตอบของชุดก่อนหน้าไว้ก่อน
  const setSelect = document.getElementById("set-select");
  if (setSelect) {
    setSelect.addEventListener("change", () => {
      // ถ้ามีชุดคำถามที่กำลังทำอยู่ ให้ซ่อน UI เดิมและเคลียร์คอนเทนต์
      if (currentSetIndex !== null) {
        const wrapper = document.getElementById("quiz-wrapper");
        const qContainer = document.getElementById("quiz-container");
        const aContainer = document.getElementById("ans-container");
        if (wrapper) wrapper.style.display = "none";
        if (qContainer) qContainer.innerHTML = "";
        if (aContainer) aContainer.innerHTML = "";

        // รีเซ็ตสถานะการแสดงผล แต่ไม่ลบคำตอบที่บันทึกไว้ใน userAnswers
        currentSetIndex = null;
        currentQuestionIndex = 0;
      }
    });
  }

  // Initialize navbar/mobile menu behaviors (sync selects and mobile toggles)
  try {
    if (typeof initNavbarToggle === 'function') initNavbarToggle();
  } catch (e) {
    console.warn('initNavbarToggle failed:', e);
  }
});


      /* ---------- LIFF initialization ---------- */
      async function initializeLIFF() {
        try {
          await liff.init({ liffId: LIFF_ID });
          if (!liff.isLoggedIn()) {
            liff.login();
          } else {
            const profile = await liff.getProfile();
            userId = profile.userId;
            userDisplayName = profile.displayName;
            imaageUrl = profile.pictureUrl;
            document.getElementById("imguser").src = imaageUrl;
            document.getElementById("user-name").innerText = userDisplayName;
          }
        } catch (error) {
          console.error("LIFF initialization failed:", error);
        }
      }


/* ---------- fetch questions from GAS ---------- */
async function loadQuestions() {
  try {
    // ✅ แสดง loading overlay
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) loadingOverlay.style.display = "flex";

    document.getElementById("quiz-wrapper").style.display = "none";
    const url =
      "https://script.google.com/macros/s/AKfycbz5TXC01ZjZveLwhuwna-E0hfoao014V1U44ugKC8NGijJRkRm2asQzDb6WtAYwIn7NkA/exec";

    // สร้าง FormData
    const formData = new FormData();
    formData.append("action", "getquiz"); // เพิ่ม field action

    // ส่ง POST request
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("โหลดข้อมูลจาก Apps Script ไม่สำเร็จ");
    setsData = await res.json();
    console.log("Quiz data:", setsData);

    // สร้าง dropdown สำหรับเลือกชุดคำถาม
    const setOptions = setsData.map((set) => set.title);
    const selectElement = createDropdown(
      setOptions,
      "set-select",
      "เลือกชุดคำถาม"
    );

    // ✅ ดึงข้อมูลเก่าของผู้ใช้กลับมา
    await loadUserPreviousData(userId);

    // ✅ เริ่มต้น result page
    setTimeout(() => {
      initResultPage();
    }, 200);
  } catch (e) {
    Swal.fire("โหลดคำถามล้มเหลว", e.message, "error");
    console.error(e);
  } finally {
    // ✅ ซ่อน loading overlay หลังจากเสร็จ
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) loadingOverlay.style.display = "none";
  }
}

// LOAD USER PREVIOUS DATA -----
async function loadUserPreviousData(userId) {
  try {
    const url =
      "https://script.google.com/macros/s/AKfycbz5TXC01ZjZveLwhuwna-E0hfoao014V1U44ugKC8NGijJRkRm2asQzDb6WtAYwIn7NkA/exec";

    // สร้าง FormData เพื่อขอข้อมูลเก่า
    const formData = new FormData();
    formData.append("action", "getuserdata"); // Action สำหรับดึงข้อมูลผู้ใช้
    formData.append("userId", userId);

    // ส่ง POST request
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.warn("ไม่สามารถดึงข้อมูลเก่าได้:", res.statusText);
      return;
    }

    const data = await res.json();
    console.log("ข้อมูลเก่าที่ดึงมา:", data);

    // ✅ Restore previous quiz results
    if (data && Array.isArray(data)) {
      showListSetTest(data); // แสดงหน้าแรกก่อน
      data.forEach((record) => {
        const setTitle = record.setTitle;
        const score = parseInt(record.score) || 0;
        const totalQuestions = parseInt(record.totalQuestions) || 1;
        const isPassed =
          record.isPassed === true ||
          record.isPassed === "true" ||
          record.isPassed === "TRUE";
        const savedAnswers = record.answers || []; // ดึงคำตอบที่บันทึกไว้

        console.log(
          `📝 Set: "${setTitle}", Score: ${score}/${totalQuestions}, Answers:`,
          savedAnswers
        );

        // เพิ่มข้อมูลลงใน userAnswers และ restore คำตอบ
        if (!userAnswers[setTitle]) {
          userAnswers[setTitle] = {
            answers: Array.isArray(savedAnswers)
              ? [...savedAnswers]
              : new Array(totalQuestions).fill(null),
            score: score,
          };
        } else {
          userAnswers[setTitle].score = score;
          // ถ้า savedAnswers มีข้อมูล ให้ restore คำตอบ
          if (Array.isArray(savedAnswers) && savedAnswers.length > 0) {
            userAnswers[setTitle].answers = [...savedAnswers];
          }
        }

        // ถ้าผ่าน ให้เพิ่มเข้า passedSets
        if (isPassed) {
          const setIndex = setsData.findIndex((s) => s.title === setTitle);
          if (setIndex >= 0) {
            passedSets.add(setIndex);
            console.log(`  ✓ ปลดล็อก set index: ${setIndex}`);
          }
        }

        // ✅ ทำเครื่องหมายว่าชุดนี้ส่งไปแล้ว (เพื่อหลีกเลี่ยงการส่งซ้ำ)
        const setIndex = setsData.findIndex((s) => s.title === setTitle);
        if (setIndex >= 0) {
          submittedSets.add(setIndex);
        }
      });

      // ✅ Update dropdown status
      updateDropdownLockStatus();
      console.log(
        "✓ คืนข้อมูลเดิมสำเร็จ - passedSets:",
        Array.from(passedSets)
      );
      console.log("✓ userAnswers:", userAnswers);
    }
  } catch (e) {
    console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลเก่า:", e);
  }
}

// SHOW LIST SET TEST -----
function showListSetTest(data) {
  console.log("แสดงหน้ารายการชุดคำถาม:", data);
  
  const listsetContainer = document.getElementById("list-set-container");
  listsetContainer.innerHTML = "";

  setsData.forEach((set, index) => {
    const item = data[index];

    const setDiv = document.createElement("div");
    setDiv.innerHTML = `
    <div class="bg-white rounded-lg border-2 p-4 shadow-md mb-4 cursor-pointer hover:shadow-lg transition hover:bg-purple-400"
      onclick="document.getElementById('set-select').selectedIndex=${index + 1}; startQuizBtn.click(); pageChange('quiz-page');"
    >
      <h3 class="text-md font-bold text-purple-700 mb-2">${set.title}</h3>
      <p class="text-sm text-gray-600 mx-8">${set.questions.length} คำถาม</p>
      <p class="text-sm text-gray-600 mx-8">
        ทำแล้ว: ${item?.answers?.filter(a => a !== null).length || 0}
        / ${item?.totalQuestions || set.questions.length}
      </p>
      </div>
    `;

        
    listsetContainer.appendChild(setDiv);
  });
}


// UPDATE DROPDOWN LOCK STATUS -----
function updateDropdownLockStatus() {
  const setSelect = document.getElementById("set-select");
  if (!setSelect) return;

  // ล้างทำความสะอาด class ปัจจุบัน
  const options = setSelect.querySelectorAll("option");
  options.forEach((opt, i) => {
    if (i === 0) return; // ข้าม default option
    const setIndex = i - 1;

    // ชุดแรก (index 0) สามารถเข้าได้เสมอ
    if (setIndex === 0) {
      opt.disabled = false;
      opt.textContent = setsData[setIndex].title;
    } else {
      // ตรวจสอบว่าชุดก่อนหน้าผ่านแล้วหรือไม่
      if (passedSets.has(setIndex - 1)) {
        opt.disabled = false;
        opt.textContent = setsData[setIndex].title;
      } else {
        opt.disabled = true;
        opt.textContent = setsData[setIndex].title + " (ล็อก)";
      }
    }
  });
}

startQuizBtn.addEventListener("click", () => {
  const setSelect = document.getElementById("set-select");
  const selectedSetIndex = setSelect.selectedIndex - 1;

  if (selectedSetIndex < 0) {
    Swal.fire("กรุณาเลือกชุดคำถามก่อนเริ่มทำแบบทดสอบ", "", "warning");
    return;
  }

  // ตรวจสอบว่าชุดนี้ถูกล็อกหรือไม่ (ต้องผ่านชุดก่อนหน้าให้ได้ >= 70%)
  if (selectedSetIndex > 0 && !passedSets.has(selectedSetIndex - 1)) {
    const prevSetTitle = setsData[selectedSetIndex - 1].title;
    const prevScore = userAnswers[prevSetTitle]?.score;
    const prevTotal = setsData[selectedSetIndex - 1].questions.length;
    const prevPercent = prevScore
      ? Math.round((prevScore / prevTotal) * 100)
      : 0;
    Swal.fire(
      "ชุดนี้ถูกล็อก",
      `คุณต้องผ่านชุด "${prevSetTitle}" ให้ได้ 70% ก่อน\nคะแนนปัจจุบัน: ${prevPercent}%`,
      "info"
    );
    return;
  }

  currentSetIndex = selectedSetIndex;
  currentQuestionIndex = 0;

  // แสดงส่วนของแบบทดสอบเมื่อกดเริ่ม
  const wrapper = document.getElementById("quiz-wrapper");
  if (wrapper) wrapper.style.display = "block";

  const setTitle = setsData[currentSetIndex].title;
  const totalQuestions = setsData[currentSetIndex].questions.length;

  // ⭐ ถ้ายังไม่เคยทำชุดนี้ → สร้าง object ใหม่
  if (!userAnswers[setTitle]) {
    userAnswers[setTitle] = {
      answers: new Array(totalQuestions).fill(null),
      score: null,
    };
  }

  showQuestion();
});

function showQuestion() {
  const setData = setsData[currentSetIndex];
  const question = setData.questions[currentQuestionIndex];

  // UI ส่วนคำถาม
  document.getElementById("quiz-container").innerHTML = `
    <div class="bg-gradient-to-r from-pink-300 to-purple-300 p-5 rounded-xl shadow mb-4">
      <h2 class="text-md font-bold text-white drop-shadow">
        ข้อที่ ${currentQuestionIndex + 1}
      </h2>
      <p class="mt-2 text-sm text-white font-medium">
        ${question.q}
      </p>
    </div>
  `;

  // UI ส่วนคำตอบ (แบบการ์ด)
  let ansContent = `
    <div class="grid grid-cols-1 gap-3">
  `;

  question.choices.forEach((option, i) => {
    ansContent += `
<label 
  for="option${i}" 
  class="choice-card flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
         bg-white shadow-md hover:shadow-lg hover:border-pink-400 hover:bg-pink-50 text-sm
         peer-checked:bg-gradient-to-r peer-checked:from-pink-200 peer-checked:to-purple-200 peer-checked:border-purple-500"
>
  <input 
    type="radio" 
    id="option${i}" 
    name="answer" 
    value="${i + 1}"
    class="peer w-6 h-6 text-purple-600 cursor-pointer text-sm
           focus:ring-0 focus:outline-none focus:border-none focus:ring-offset-0"
    onchange="highlightAnswer(this)"
  >
  <span class="ml-4 text-gray-800 font-semibold peer-checked:text-purple-700 peer-checked:font-bold transition-all text-xs md:text-sm">
    ${option}
  </span>
</label>

  `;
  });

  ansContent += `</div>`;

  document.getElementById("ans-container").innerHTML = ansContent;

  // ⭐ Restore answer (support both old-text answer and new numeric-index answer)
  const savedAns = userAnswers[setData.title].answers[currentQuestionIndex];
  if (savedAns !== null && savedAns !== undefined) {
    // First try to find input with value === savedAns (works if we store numeric indices)
    let radio = document.querySelector(
      `input[name="answer"][value="${savedAns}"]`
    );
    if (!radio) {
      // Fallback: savedAns might be the option text (old format). Try to find matching choice index.
      const textIndex = question.choices.findIndex(
        (c) => String(c) === String(savedAns)
      );
      if (textIndex >= 0) {
        radio = document.getElementById(`option${textIndex}`);
      }
    }

    if (radio) {
      radio.checked = true;
      // ไฮไลต์ card ของคำตอบที่บันทึกไว้
      const label = radio.closest("label");
      if (label) {
        label.style.background =
          "linear-gradient(to right, rgb(251, 207, 232), rgb(221, 214, 254))";
        label.style.borderColor = "rgb(168, 85, 247)";
      }
    }
  }

  updateButtons();
}

function updateButtons() {
  const total = setsData[currentSetIndex].questions.length;

  prevBtn.disabled = currentQuestionIndex === 0;

  // ถ้าเป็นข้อสุดท้าย เปลี่ยน label เป็น "ส่ง" แต่ไม่ disable
  if (currentQuestionIndex === total - 1) {
    nextBtn.textContent = "ส่ง";
    nextBtn.disabled = false;
  } else {
    nextBtn.textContent = "ถัดไป";
    nextBtn.disabled = false; // ปล่อยให้กดได้ปกติ
  }
}

function calculateScore() {
  const setData = setsData[currentSetIndex];
  const setTitle = setData.title;

  // ✅ ตรวจสอบว่าเคยส่งชุดนี้ไปแล้วหรือไม่ (ถ้า ALLOW_RESUBMIT = false)
  if (!ALLOW_RESUBMIT && submittedSets.has(currentSetIndex)) {
    console.log(`⚠️ ชุด "${setTitle}" เคยบันทึกไปแล้ว จะไม่ส่งซ้ำ`);
    Swal.fire(
      "บันทึกแล้ว",
      `ชุด "${setTitle}" เคยบันทึกคะแนนไปแล้ว\nคะแนนปัจจุบัน: ${
        userAnswers[setTitle]?.score || 0
      }/${setData.questions.length}`,
      "info"
    );
    return;
  }

  const answers = userAnswers[setTitle].answers; // คำตอบของผู้ใช้
  let score = 0;

  // เดินทีละคำถามเพื่อตรวจคำตอบ
  setData.questions.forEach((q, i) => {
    const userAns = answers[i];
    // หา index ของคำตอบที่ถูกต้อง (0-based)
    const correctIndex = q.choices.findIndex(
      (c) => String(c) === String(q.answer)
    );
    // ถ้าผู้ใช้เก็บเป็นข้อความคำตอบเดิม (compat) ให้ตรวจสอบด้วย
    const isMatchText = String(userAns) === String(q.answer);
    const isMatchIndex =
      typeof userAns !== "undefined" &&
      userAns !== null &&
      String(userAns) === String(correctIndex + 1);

    if (isMatchText || isMatchIndex) {
      score++;
    }
  });

  // เก็บคะแนนในโครงสร้าง userAnswers
  userAnswers[setTitle].score = score;

  const totalQuestions = setData.questions.length;
  const percentage = Math.round((score / totalQuestions) * 100);
  const isPassed = score >= Math.ceil(totalQuestions * 0.7); // 70% ขึ้นไป

  // ถ้าผ่าน ให้เพิ่มชุดนี้เข้า passedSets และอัพเดท dropdown
  if (isPassed) {
    passedSets.add(currentSetIndex);
    updateDropdownLockStatus();
  }

  const resultMessage = isPassed
    ? `✓ ยินดีด้วย! คุณผ่านแล้ว (${percentage}%)`
    : `✗ ไม่ผ่าน ต้องได้ 70% ขึ้นไป (${percentage}%)`;

  Swal.fire({
    title: "สรุปคะแนน",
    html: `<div style="text-align: center;">
      <p>${resultMessage}</p>
      <p style="font-size: 1.2em; margin-top: 10px;"><strong>คุณได้ ${score} / ${totalQuestions} คะแนน</strong></p>
      <p style="font-size: 0.9em; color: #666; margin-top: 8px;">${userDisplayName || 'ผู้ใช้'}</p>
    </div>`,
    icon: isPassed ? "success" : "warning",
    showCancelButton: true,
    confirmButtonText: "📤 แชร์ผล",
    cancelButtonText: "ปิด",
    confirmButtonColor: isPassed ? "#10b981" : "#f97316",
    cancelButtonColor: "#6b7280"
  }).then((result) => {
    if (result.isConfirmed) {
      shareResultToLine(setTitle, score, totalQuestions, percentage, isPassed);
    }
  });

  // ✅ ส่งคะแนนและคำตอบไปยัง Google Sheets (และทำเครื่องหมายว่าส่งไปแล้ว)
  const answersToSend = userAnswers[setTitle]?.answers || [];
  sendScoreToGoogleSheet(
    setTitle,
    score,
    totalQuestions,
    percentage,
    isPassed,
    answersToSend
  );

  const summary = buildScoreSummary();
  showListSetTest(summary);

  console.log(
    "คะแนนชุด:",
    setTitle,
    "=",
    score,
    "(",
    percentage,
    "%)ผ่าน:",
    isPassed
  );
}

function buildScoreSummary() {
  return setsData.map(set => {
    const title = set.title;
    const total = set.questions.length;

    if (userAnswers[title]) {
      return {
        title: title,
        score: userAnswers[title].score || 0,
        totalQuestions: total
      };
    }
    return {
      title: title,
      score: 0,
      totalQuestions: total
    };
  });
}


// NEXT -----
nextBtn.addEventListener("click", () => {
  // บันทึกคำตอบก่อนเสมอ
  saveAnswer();

  const qLength = setsData[currentSetIndex].questions.length;

  // ถ้ายังไม่ถึงข้อสุดท้าย → ไปข้อถัดไป
  if (currentQuestionIndex < qLength - 1) {
    currentQuestionIndex++;
    showQuestion();
    return;
  }

  // ถ้าเป็นข้อสุดท้าย → คำนวณคะแนน และ log
  calculateScore();

  const setTitle = setsData[currentSetIndex].title;
  console.log("คะแนนชุด", setTitle, "=", userAnswers[setTitle].score);

  // (ถ้าต้องการเปลี่ยนหน้าไปหน้า result ให้เปิดคอมเมนต์บรรทัดด้านล่าง)
  // pageChange("result-page");
  // document.getElementById("score-text").innerText =
  //   `คุณได้ ${userAnswers[setTitle].score} / ${qLength} คะแนน`;
});

// PREV -----
prevBtn.addEventListener("click", () => {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
});

// SAVE ANSWER -----
function saveAnswer() {
  const selected = document.querySelector("input[name='answer']:checked");
  if (!selected) return;

  const setTitle = setsData[currentSetIndex].title;
  userAnswers[setTitle].answers[currentQuestionIndex] = selected.value;

  console.log("Updated userAnswers:", userAnswers);
}

// HIGHLIGHT ANSWER -----
function highlightAnswer(radioElement) {
  // ลบ highlight จากทั้งหมด
  document.querySelectorAll(".choice-card").forEach((card) => {
    card.style.background = "white";
    card.style.borderColor = "rgb(229, 231, 235)"; // gray-200
  });

  // เพิ่ม highlight ไปที่ที่เลือก
  const selectedLabel = radioElement.closest("label");
  if (selectedLabel) {
    selectedLabel.style.background =
      "linear-gradient(to right, rgb(251, 207, 232), rgb(221, 214, 254))";
    selectedLabel.style.borderColor = "rgb(168, 85, 247)"; // purple-500
    selectedLabel.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.3)";
  }
}

// NAVBAR / MOBILE MENU INIT -----
function initNavbarToggle() {
  const btn = document.getElementById('nav-toggle-btn');
  const menu = document.getElementById('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('hidden');
    });
  }
  // Mobile start button should trigger desktop start button (no dropdown sync)
  const startMobile = document.getElementById('start-quiz-btn-mobile');
  if (startMobile) {
    startMobile.addEventListener('click', () => {
      const startDesktop = document.getElementById('start-quiz-btn');
      if (startDesktop) startDesktop.click();
      if (menu) {
        menu.classList.add('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Header start button should trigger the main start button (no header dropdown)
  const startHeader = document.getElementById('start-quiz-btn-header');
  if (startHeader) {
    startHeader.addEventListener('click', () => {
      const startDesktop = document.getElementById('start-quiz-btn');
      if (startDesktop) startDesktop.click();
    });
  }

  // Close mobile menu when a link inside is clicked
  if (menu) {
    menu.querySelectorAll('a').forEach((el) => {
      el.addEventListener('click', () => {
        menu.classList.add('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Hide mobile menu when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && menu) {
      menu.classList.add('hidden');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// BUILD SCORE FLEX MESSAGE FOR LINE SHARING -----
function buildScoreFlexMessage(setTitle, score, totalQuestions, percentage, isPassed) {
  const statusColor = isPassed ? "#10b981" : "#ef4444";
  const statusLabel = isPassed ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
  const userInfo = userDisplayName || "ผู้ใช้";
  const scoreText = `${score} / ${totalQuestions} (${percentage}%)`;

  return {
    type: "flex",
    altText: `${userInfo} ทำข้อสอบ "${setTitle}" ได้ ${scoreText}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "📊 ผลการทำแบบทดสอบ",
            weight: "bold",
            size: "xl",
            color: "#333333"
          },
          {
            type: "separator"
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: "ชื่อชุด:",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: setTitle,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 3
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: "ผู้ทำสอบ:",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: userInfo,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 3
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: "คะแนน:",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: scoreText,
                    wrap: true,
                    color: "#333333",
                    size: "sm",
                    flex: 3,
                    weight: "bold"
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: "สถานะ:",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: statusLabel,
                    wrap: true,
                    color: statusColor,
                    size: "sm",
                    flex: 3,
                    weight: "bold"
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `🎓 ทำข้อสอบเมื่อ ${new Date().toLocaleString('th-TH')}`,
            size: "xs",
            color: "#999999",
            align: "center"
          }
        ]
      }
    }
  };
}

// SHARE RESULT TO LINE -----
async function shareResultToLine(setTitle, score, totalQuestions, percentage, isPassed) {
  try {
    const flexMessage = buildScoreFlexMessage(setTitle, score, totalQuestions, percentage, isPassed);
    await liff.shareTargetPicker([flexMessage], {
      isMultiple: true
    });
    console.log('✓ แชร์ผลการสอบสำเร็จ');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการแชร์:', error);
    Swal.fire('ไม่สามารถแชร์ได้', 'กรุณาลองใหม่อีกครั้ง', 'error');
  }
}

// SEND SCORE TO GOOGLE SHEET -----
async function sendScoreToGoogleSheet(
  setTitle,
  score,
  totalQuestions,
  percentage,
  isPassed,
  answers
) {
  try {
    const url =
      "https://script.google.com/macros/s/AKfycbz5TXC01ZjZveLwhuwna-E0hfoao014V1U44ugKC8NGijJRkRm2asQzDb6WtAYwIn7NkA/exec";

    // สร้าง FormData สำหรับส่งคะแนน
    const formData = new FormData();
    formData.append("action", "savescore"); // Action สำหรับ Google Apps Script
    formData.append("userId", userId);
    formData.append("setTitle", setTitle);
    formData.append("score", score);
    formData.append("totalQuestions", totalQuestions);
    formData.append("percentage", percentage);
    formData.append("isPassed", isPassed);
    // เพิ่มคำตอบของผู้ใช้ (serialize เป็น JSON)
    try {
      formData.append("answers", JSON.stringify(answers || []));
    } catch (e) {
      console.warn("ไม่สามารถ serialize answers:", e);
      formData.append("answers", "[]");
    }
    formData.append("timestamp", new Date().toISOString());

    // ส่ง POST request
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      console.warn("ส่งคะแนนไปยัง Google Sheets ไม่สำเร็จ:", res.statusText);
      return;
    }

    const result = await res.json();
    console.log("✓ ส่งคะแนนสำเร็จ:", result);

    // ✅ ทำเครื่องหมายว่าชุดนี้ส่งไปแล้ว (เพื่อหลีกเลี่ยงการส่งซ้ำ)
    submittedSets.add(currentSetIndex);
    console.log("📌 บันทึก submitted sets:", Array.from(submittedSets));
  } catch (e) {
    console.error("❌ เกิดข้อผิดพลาดในการส่งคะแนน:", e);
  }
}

/* ========== RESULT PAGE FUNCTIONS ========== */

let resultChart = null; // เก็บ instance ของ Chart

function initResultPage() {
  // แสดงสรุปของทุกชุด (grid)
  showResultsSummary();
}

function showResultsSummary() {
  const gridContainer = document.getElementById("results-summary-grid");
  gridContainer.innerHTML = "";
  let firstSetWithData = null;

  setsData.forEach((set, index) => {
    const setTitle = set.title;
    const userAnswer = userAnswers[setTitle];
    console.log("ตรวจสอบผลชุด:", setTitle, userAnswer);
    // Determine completion and permission to view results.
    const answersArr = userAnswer && Array.isArray(userAnswer.answers) ? userAnswer.answers : [];
    const totalQ = set.questions.length;
    const answeredCount = answersArr.filter(a => a !== null && a !== undefined && String(a).trim() !== "").length;
    const isCompleted = answeredCount === totalQ;

    // Allow viewing only when fully completed OR when the set was submitted/recorded on server
    const wasSubmitted = submittedSets.has(index);
    const allowView = isCompleted || wasSubmitted;

    if (allowView && firstSetWithData === null) {
      firstSetWithData = index;
    }

    if (allowView) {
      const score = userAnswer && userAnswer.score !== undefined ? userAnswer.score : 0;
      const total = totalQ;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      const isPassed = percentage >= 70;

      const card = document.createElement("div");
      card.className = `bg-white rounded-lg border-2 p-4 shadow-md cursor-pointer transition hover:shadow-lg ${
        isPassed ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
      }`;

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <h6 class="font-bold text-gray-800">${setTitle}</h6>
            <p class="text-sm text-gray-600 mt-1">คะแนน: <span class="font-semibold text-lg ${isPassed ? "text-green-600" : "text-red-600"}">${score}/${total}</span></p>
            <p class="text-sm text-gray-600">${percentage}%</p>
          </div>
          <div class="text-lg">${isPassed ? "✅" : "❌"}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        loadResultDetail(index);
      });

      gridContainer.appendChild(card);
    } else {
      // Not completed and not submitted -> show as locked (cannot view results)
      const lockedCard = document.createElement("div");
      lockedCard.className = "bg-gray-100 rounded-lg border-2 border-gray-300 p-4 shadow-sm opacity-80";
      lockedCard.innerHTML = `
        <h6 class="font-bold text-gray-600">${setTitle}</h6>
        <p class="text-sm text-gray-500 mt-2">ยังไม่ทำครบทั้งหมด (${answeredCount}/${totalQ}) — ต้องทำให้ครบก่อนจึงจะดูผลได้</p>
      `;
      lockedCard.addEventListener("click", () => {
        Swal.fire(
          "ยังดูผลไม่ได้",
          `คุณต้องตอบครบ ${totalQ} ข้อก่อนจึงจะดูผลลัพธ์ได้ (ตอนนี้ตอบ ${answeredCount}/${totalQ} ข้อ)`,
          "info"
        );
      });
      gridContainer.appendChild(lockedCard);
    }
  });

  // Auto-load first set with data
  if (firstSetWithData !== null) {
    loadResultDetail(firstSetWithData);
  }
}

function loadResultDetail(setIndex) {
  const set = setsData[setIndex];
  const setTitle = set.title;
  const userAnswer = userAnswers[setTitle];

  const detailContainer = document.getElementById("result-detail-container");
  const noResultMessage = document.getElementById("no-result-message");

  // Enforce: only allow viewing when user completed all answers OR the set was submitted/recorded
  const answersArr = userAnswer && Array.isArray(userAnswer.answers) ? userAnswer.answers : [];
  const totalQ = set.questions.length;
  const answeredCount = answersArr.filter(a => a !== null && a !== undefined && String(a).trim() !== "").length;
  const isCompleted = answeredCount === totalQ;
  const wasSubmitted = submittedSets.has(setIndex);

  if (!isCompleted && !wasSubmitted) {
    Swal.fire(
      "ยังดูผลไม่ได้",
      `คุณต้องตอบครบ ${totalQ} ข้อก่อนจึงจะดูรายละเอียดผลลัพธ์ได้ (ตอนนี้ตอบ ${answeredCount}/${totalQ} ข้อ)`,
      "info"
    );
    return;
  }

  noResultMessage.style.display = "none";
  detailContainer.style.display = "block";

  const score = userAnswer.score;
  const total = set.questions.length;
  const percentage = Math.round((score / total) * 100);
  const isPassed = percentage >= 70;

  // อัปเดตข้อมูลสรุป
  document.getElementById("detail-score").textContent = `${score}/${total}`;
  document.getElementById("detail-percentage").textContent = `${percentage}%`;
  document.getElementById("detail-total").textContent = total;
  
  const statusEl = document.getElementById("detail-status");
  if (isPassed) {
    statusEl.innerHTML = "✅ ผ่าน";
    statusEl.className = "text-sm font-bold text-green-600 mb-2";
  } else {
    statusEl.innerHTML = "❌ ไม่ผ่าน";
    statusEl.className = "text-sm font-bold text-red-600 mb-2";
  }

  // วาดกราฟ
  renderResultChart(score, total - score);

  // แสดงรายละเอียดคำตอบ
  showAnswerDetails(set, userAnswer);
}

function renderResultChart(correct, incorrect) {
  const ctx = document.getElementById("result-chart").getContext("2d");
  
  if (resultChart) {
    resultChart.destroy();
  }

  resultChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["✅ ถูก", "❌ ผิด"],
      datasets: [
        {
          data: [correct, incorrect],
          backgroundColor: ["#10b981", "#ef4444"],
          borderColor: ["#059669", "#dc2626"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 14, weight: "bold" },
            padding: 15,
          },
        },
      },
    },
  });
}

function showAnswerDetails(set, userAnswer) {
  const container = document.getElementById("answer-details-container");
  container.innerHTML = "";

  set.questions.forEach((question, index) => {
    // Support GAS numeric answer (1-based index) while also being compatible
    // with older text-based stored answers. We want to display the choice
    // text for both the user's selection and the correct answer.
    const choices = question.choices || [];

    const rawUser = userAnswer.answers[index];
    const rawCorrect = question.answer;

    // Try parse numeric indices (1-based). If valid, map to choice text.
    const userIdx = Number(rawUser);
    const correctIdx = Number(rawCorrect);

    const userText =
      Number.isInteger(userIdx) && userIdx > 0 && userIdx <= choices.length
        ? choices[userIdx - 1]
        : (rawUser !== undefined && rawUser !== null ? String(rawUser).trim() : "");

    const correctText =
      Number.isInteger(correctIdx) && correctIdx > 0 && correctIdx <= choices.length
        ? choices[correctIdx - 1]
        : (rawCorrect !== undefined && rawCorrect !== null ? String(rawCorrect).trim() : "");

    // Determine correctness: prefer numeric comparison if both are numeric indices,
    // otherwise fall back to text comparison (trimmed).
    let isCorrect = false;
    if (
      Number.isInteger(userIdx) &&
      Number.isInteger(correctIdx) &&
      !Number.isNaN(userIdx) &&
      !Number.isNaN(correctIdx)
    ) {
      isCorrect = userIdx === correctIdx;
    } else {
      const ua = (userText || "").toString().trim();
      const ca = (correctText || "").toString().trim();
      isCorrect = ua !== "" && ua === ca;
    }

    console.log(
      `ข้อที่ ${index + 1}: userRaw="${rawUser}" userText="${userText}" | correctRaw="${rawCorrect}" correctText="${correctText}" | match=${isCorrect}`
    );

    const answerCard = document.createElement("div");
    answerCard.className = `p-4 rounded-lg border-l-4 ${
      isCorrect ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"
    }`;

    const questionTitle = `<div class="font-bold text-xs text-gray-800 mb-3">ข้อที่ ${index + 1}: ${
      question.q || question.question || "คำถาม"
    }</div>`;

    const answerSection = `
      <div class="space-y-2 text-xs">
        <div>
          <span class="font-semibold text-gray-700">คำตอบของคุณ:</span>
          <span class="ml-2 ${isCorrect ? "text-green-700 font-bold" : "text-red-700 font-bold"}">
            ${userText || "ไม่ได้ตอบ"}
          </span>
        </div>
        <div>
          <span class="font-semibold text-gray-700">เฉลยที่ถูก:</span>
          <span class="ml-2 text-blue-700 font-bold">${correctText}</span>
        </div>
        <div class="text-right mt-3">
          ${isCorrect ? '✅ ตอบถูก' : '❌ ตอบผิด'}
        </div>
      </div>
    `;

    answerCard.innerHTML = questionTitle + answerSection;
    container.appendChild(answerCard);
  });
}



