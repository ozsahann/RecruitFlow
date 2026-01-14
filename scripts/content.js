/* scripts/content.js */

// showpageaction 
const todoresp = {todo: "showPageAction"};
chrome.runtime.sendMessage(todoresp);

// Bekleme Fonksiyonu
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// VERİLERİ YENİLEME FONKSİYONU
function refreshSliderData() {
    console.log("RecruitFlow: Veriler tazeleniyor...");
    const basicProfileData = getBasicProfileSection();
    const expData = getExperienceSection();

    // İsim alanını güncelle (Span olduğu için innerText/textContent gerekir)
    const nameLabel = document.getElementById("name_title");
    if (nameLabel) {
        nameLabel.textContent = basicProfileData.name || "İsim bulunamadı";
    }

    // Textarea alanlarını doldur
    injectDataintoTextArea("basicprofile", basicProfileData);
    injectDataintoTextArea("experiencetext", expData);
}

function loadSlider() {
    const sliderContainer = document.createElement("div");
    sliderContainer.id = "yale3_slider";

    fetch(chrome.runtime.getURL("views/slider.html"))
        .then(response => response.text())
        .then(sliderHTML => {
            sliderContainer.innerHTML += sliderHTML;
            document.body.prepend(sliderContainer);

            setTimeout( () => {
                // İlk açılışta verileri çek
                refreshSliderData();
                
                // YENİLE BUTONU AKTİF ETME
                const refreshButton = document.getElementById("refresh_profile_data_button");
                if (refreshButton) {
                    refreshButton.addEventListener("click", () => {
                        refreshSliderData();
                    });
                }

                // SİSTEME AKTAR BUTONU
                let saveButton = document.getElementById("save_profile_data_button");
                if(saveButton) {
                    const newButton = saveButton.cloneNode(true);
                    saveButton.parentNode.replaceChild(newButton, saveButton);
                    newButton.addEventListener("click", async () => {
                        newButton.innerText = "⏳ Aktarılıyor...";
                        
                        const basicData = getBasicProfileSection();
                        const expData = getExperienceSection();
                        const contactInfo = await scrapeContactInfoModal();
                        
                        await saveProfileData(basicData, expData, contactInfo);
                        
                        newButton.innerText = "Sisteme Aktar";
                    });
                }
            }, 2000);

            let lastUrl = location.href;
            setInterval( () => {
                if(location.href !== lastUrl) {
                    setTimeout( () => {
                        refreshSliderData();
                        lastUrl = location.href;
                    }, 1000); 
                }
            }, 500);
           
        }).catch(error => console.error("Slider yüklenemedi: ", error));
}

loadSlider();

// Slider Aç/Kapa
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if(msg.todo == "toggle") {
       toggleSlider(); 
    }
});

function toggleSlider() {
    const slider = document.getElementById("yale3_slider");
    const styler = slider.style;
    styler.width = (styler.width === "0px" || !styler.width) ? "450px" : "0px";
}

// --- YARDIMCI FONKSİYONLAR ---

function validateSelector(selectorGroup, baseNode=document) {
    const results = {};
    for( const [key, selector] of Object.entries(selectorGroup)) {
        if (typeof selector !== "string") continue;
        const element = baseNode.querySelector(selector);
        results[key] = element ? true : false;
    }
    return results;
}

function getBasicProfileSection() {
    const data = {};
    const validationResults = validateSelector(window.selectors.basicProfile);
    for(const [key, isValid] of Object.entries(validationResults)) {
        if(isValid) {
            const element = document.querySelector(window.selectors.basicProfile[key]);
            if(element.tagName === "IMG") {
                data[key] = element?.src || "";
            } else {
                data[key] = element?.textContent.trim();
            }
        } else {
            data[key] = "";
        }
    }
    return data;
}

function getExperienceSection() {
    const sections = document.querySelectorAll("section[data-view-name='profile-card']");
    const expNode = Array.from(sections).find(sec => sec.querySelector('#experience')) || null;
    if (!expNode) return [];

    const items = [];
    const listItems = expNode.querySelectorAll('li.artdeco-list__item');
    listItems.forEach((li) => {
        const titleElem = li.querySelector(".t-bold span[aria-hidden='true']");
        if (titleElem) items.push({ jobTitle: titleElem.textContent.trim() });
    });
    return items;
}

// ELEMENT TÜRÜNE GÖRE VERİ GİRİŞİ (Fix: Hem span hem textarea destekler)
function injectDataintoTextArea(nodeId, data) {
    const element = document.getElementById(nodeId);
    if(element) {
        const textValue = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
            element.value = textValue;
        } else {
            element.textContent = textValue;
        }
    }
}

async function scrapeContactInfoModal() {
    let email = null, phone = null;
    try {
        const contactLink = document.getElementById('top-card-text-details-contact-info');
        if (contactLink) {
            contactLink.click();
            await wait(1000); 
            const emailElem = document.querySelector('a[href^="mailto:"]');
            if (emailElem) email = emailElem.textContent.trim();
            const phoneElem = document.querySelector('.pv-contact-info__contact-type--phone span');
            if (phoneElem) phone = phoneElem.innerText.trim();
            const closeBtn = document.querySelector('button[aria-label="Dismiss"]') || document.querySelector('.artdeco-modal__dismiss');
            if (closeBtn) closeBtn.click();
            await wait(300);
        }
    } catch (e) { console.error("İletişim hatası:", e); }
    return { email, phone };
}

async function saveProfileData(basicData, expData, contactInfo) {
    let fullName = (basicData.name || "").trim();
    let name = null, family = null;
    if (fullName) {
        const parts = fullName.split(" ");
        family = parts.length > 1 ? parts.pop() : null;
        name = parts.join(" ") || null;
    }
    const cleanUrl = window.location.href.split('/overlay/')[0];
    const finalPayload = {
        "Name": name, "Family": family,
        "Email": (contactInfo.email && contactInfo.email.trim() !== "") ? contactInfo.email : cleanUrl, 
        "PhoneNumber": contactInfo.phone, "LinkedinUrl": cleanUrl,
        "Description": (basicData.about && basicData.about.trim() !== "") ? basicData.about : (basicData.headline || null),   
        "CompanyPositionId": 724         
    };
    chrome.runtime.sendMessage({ type: "downloadProfile", content: JSON.stringify(finalPayload) });
}