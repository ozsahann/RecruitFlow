/* scripts/content.js */
let allPositions = [];

const todoresp = {todo: "showPageAction"};
chrome.runtime.sendMessage(todoresp);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// TÜM VERİLERİ VE POZİSYONLARI YENİLEME FONKSİYONU
function refreshSliderData() {
    console.log("RecruitFlow: Tüm veriler ve pozisyonlar tazeleniyor...");
    const basicProfileData = getBasicProfileSection();
    const expData = getExperienceSection();

    // İsim alanını güncelle
    const nameLabel = document.getElementById("name_title");
    if (nameLabel) {
        nameLabel.textContent = basicProfileData.name || "İsim bulunamadı";
    }

    // Textarea alanlarını doldur
    injectDataintoTextArea("basicprofile", basicProfileData);
    injectDataintoTextArea("experiencetext", expData);
    
    // Pozisyon listesini API'den çek
    loadPositionsIntoDropdown();
}

// POZİSYONLARI API'DEN ÇEKİP DROPDOWN'A DOLDURAN FONKSİYON
function loadPositionsIntoDropdown() {
    const positionSelect = document.getElementById("position_select");
    const positionSearch = document.getElementById("position_search");
    if (!positionSelect) return;

    chrome.runtime.sendMessage({ type: "getPositions" }, (response) => {
        if (response && response.success) {
            // image_d49dcf.png'deki yapıya göre veriyi alıyoruz
            allPositions = (response.data && response.data.data) ? response.data.data : [];
            
            // İlk açılışta tüm listeyi isimleriyle birlikte göster
            renderPositions(allPositions);

            // Arama barı aktifse filtreleme dinleyicisini ekle
            if (positionSearch) {
                positionSearch.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filtered = allPositions.filter(item => {
                        const pos = item.companyPosition || item;
                        // İsim (name) veya Başlık (title) üzerinden arama yapar
                        const posName = (pos.name || pos.title || "").toLowerCase();
                        return posName.includes(searchTerm);
                    });
                    renderPositions(filtered);
                });
            }
        } else {
            positionSelect.innerHTML = "<option value=''>❌ Liste Alınamadı</option>";
        }
    });
}

// Listeyi ekrana basan yardımcı fonksiyon
function renderPositions(list) {
    const positionSelect = document.getElementById("position_select");
    if (!positionSelect) return;
    
    positionSelect.innerHTML = "";
    
    if (list.length === 0) {
        positionSelect.innerHTML = "<option value=''>Sonuç bulunamadı</option>";
        return;
    }

    list.forEach(item => {
        // API yapısına göre pozisyon verisini alıyoruz
        const pos = item.companyPosition || item;
        
        if (pos && pos.id) {
            const option = document.createElement("option");
            option.value = pos.id;
            
            // İstediğiniz format: Pozisyon İsmi#ID (Örn: Deneme ilan açıyorum#1139)
            const posName = pos.name || pos.title || "Adsız Pozisyon";
            option.textContent = `${posName}#${pos.id}`;
            
            positionSelect.appendChild(option);
        }
    });
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
                // İlk açılışta verileri ve pozisyonları çek
                refreshSliderData();
                
                // YENİLE BUTONU
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

// --- YARDIMCI FONKSİYONLAR (Aynı Kalacak) ---

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

function validateSelector(selectorGroup, baseNode=document) {
    const results = {};
    for( const [key, selector] of Object.entries(selectorGroup)) {
        if (typeof selector !== "string") continue;
        const element = baseNode.querySelector(selector);
        results[key] = element ? true : false;
    }
    return results;
}

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
    const cleanUrl = window.location.href.split('/overlay/')[0];
    
    // Seçilen Pozisyon ID'sini al
    const posSelect = document.getElementById("position_select");
    const selectedPosId = posSelect ? posSelect.value : null;

    const finalPayload = {
        "Name": (basicData.name || "").split(" ")[0] || null,
        "Family": (basicData.name || "").split(" ").pop() || null,
        "Email": (contactInfo.email && contactInfo.email.trim() !== "") ? contactInfo.email : cleanUrl, 
        "PhoneNumber": contactInfo.phone, 
        "LinkedinUrl": cleanUrl,
        "Description": (basicData.about && basicData.about.trim() !== "") ? basicData.about : (basicData.headline || null),   
        "CompanyPositionId": selectedPosId ? parseInt(selectedPosId) : 724         
    };
    chrome.runtime.sendMessage({ type: "downloadProfile", content: JSON.stringify(finalPayload) });
}

// Slider Aç/Kapa
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if(msg.todo == "toggle") {
        const slider = document.getElementById("yale3_slider");
        if (slider) {
            slider.style.width = (slider.style.width === "450px") ? "0px" : "450px";
        }
    }
});

loadSlider();