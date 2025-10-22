let llmQuery = document.getElementById("llmQuery");
let llmSendButton = document.getElementById("sendButton");
let llmResponse = document.getElementById("llmResponse");

llmSendButton.addEventListener("click", () => {
    getLLMResponse(llmQuery.value);
});

async function getLLMResponse(query) {
    console.log("Fake LLM Request...");
    llmResponse.textContent = "Fake LLM Response";
}