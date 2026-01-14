/* scripts/events.js */

// İkon tıklama olayları - Slider'ı açar/kapatır
chrome.action.onClicked.addListener(function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0].url && tabs[0].url.includes("linkedin.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { todo: "toggle" }, function(response) {
                if (chrome.runtime.lastError) console.log("Hata:", chrome.runtime.lastError.message);
            });
        }
    });
});

// Mesaj dinleyici
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    
    // 1. Profil Verilerini Sisteme Aktarma (POST işlemi)
    if (msg.type === "downloadProfile") {
        console.log("🚀 Veri alındı, gönderiliyor...");

        // config.json dosyasından Token'ı oku
        fetch(chrome.runtime.getURL('config.json')) 
            .then(res => res.json())
            .then(config => {
                const myToken = config.API_TOKEN;
                const apiUrl = "https://testbackend.recruitcrafts.com/api/Candidate/Post";

                if (!myToken) {
                    console.error("❌ Token bulunamadı! config.json dosyasını kontrol et.");
                    return;
                }

                // API İsteği
                return fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + myToken
                    },
                    body: msg.content // content.js'den gelen JSON string
                });
            })
            .then(response => {
                if (!response) return;

                if (response.ok) {
                    console.log("✅ BAŞARILI: Kayıt oluşturuldu.");
                } else {
                    response.text().then(text => {
                        console.error("❌ SUNUCU HATASI:", text);
                        // Hata ayıklama: Kayıt hatası durumunda dönen detayı gör
                        console.log("📡 Aday Kayıt API Yanıt Detayı:", text);
                    });
                }
            })
            .catch(error => {
                console.error("❌ AĞ HATASI:", error);
            });

        return true; // Asenkron yanıt desteği için
    }

    // 2. Dinamik Pozisyon Listesini Çekme İşlemi (Suggestion API)
    else if (msg.type === "getPositions") {
        fetch(chrome.runtime.getURL('config.json'))
            .then(res => res.json())
            .then(config => {
                const apiUrl = "https://testbackend.recruitcrafts.com/api/CandidatePosition/Suggestion/";
                
                const payload = {
                    "pageSize": 15,
                    "pageNumber": 1,
                    "orderBy": "UpdateDate desc",
                    "includeProperties": "Candidate.Person.PersonExpertises.Expertise,Candidate.Person.PersonEducations,Candidate.Person.PersonExperiences,Candidate.CreateBy,CandidatePositionStatus,CompanyPosition.Company,CompanyPosition.CompanyPositionStatus,CreateBy,Candidate.CandidateTagAssignments",
                    "companyPositionId": null
                };

                return fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + config.API_TOKEN
                    },
                    body: JSON.stringify(payload)
                });
            })
            .then(response => response.json())
            .then(data => {
                // HATA AYIKLAMA MODU: Gelen ham veriyi Service Worker konsolunda görebilirsiniz
                console.log("📡 Pozisyon API Yanıtı (Suggestion):", data);
                
                // Pozisyon verilerini content.js'e geri gönder
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error("❌ Pozisyon Listesi Hatası:", error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // Asenkron yanıt desteği için gerekli
    }
});