// İkon tıklama olayları
chrome.action.onClicked.addListener(function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0].url && tabs[0].url.includes("linkedin.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { todo: "toggle" }, function(response) {
                if (chrome.runtime.lastError) console.log("Hata:", chrome.runtime.lastError.message);
            });
        }
    });
});

// Mesaj dinleyici (POST işlemi burada)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
                    body: msg.content // content.js'den gelen hazır JSON string'i
                });
            })
            .then(response => {
                if (!response) return;

                if (response.ok) {
                    console.log("✅ BAŞARILI: Kayıt oluşturuldu.");
                    // İstersen burada bildirim gösterebilirsin
                } else {
                    response.text().then(text => console.error("❌ SUNUCU HATASI:", text));
                }
            })
            .catch(error => {
                console.error("❌ AĞ HATASI:", error);
            });

        return true; 
    }
});