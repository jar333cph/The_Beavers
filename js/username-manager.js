const usernameInput = document.getElementById("username-input");

usernameInput.addEventListener("change", () => {
   localStorage.setItem("current-user", usernameInput.value);
});

document.addEventListener("keydown", function(event) {
  if (event.key === "T" || event.key === "t") {
      console.log("T was pressed!");
      var currentUser = localStorage.getItem("current-user");
      var currentUserScore = localStorage.getItem(currentUser + "-score");

      currentUserScore = Number(currentUserScore) + 1337;
      localStorage.setItem(currentUser + "-score", currentUserScore);
      console.log("Score updated for " + currentUser + ": " + currentUserScore);
  }
});

document.addEventListener("keydown", function(event) {
  if (event.key === "-") {
    var currentUser = localStorage.getItem("current-user");
    console.log("Clearing score of " + currentUser);
    localStorage.setItem(currentUser + "-score", 0);
  }
});

// current user: username
// score: username-score 
// highest level unlocked: username-highest-level