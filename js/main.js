import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyCJMYa7nZ4nwFdLkAlOP7uUdoOsLaXVO-k");

let llmQuery = document.getElementById("llmQuery");
let llmResponse = document.getElementById("llmResponse");
let llmSendButton = document.getElementById("llmSendButton");

llmSendButton.addEventListener("click", async () => {
  const query = llmQuery.value;
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(query);
  llmResponse.textContent = result.response.text();
});

