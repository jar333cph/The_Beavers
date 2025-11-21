updateLeaderboard();

document.addEventListener("keydown", function(event) {
   // always call function to redo work
   updateLeaderboard();
});

function updateLeaderboard() {
  const currentUser = localStorage.getItem("current-user");
  const currentUserScore = localStorage.getItem(currentUser + "-score");
  var leaderboardUserName = document.getElementById("leaderboard-user-name");
  var leaderboardUserScore = document.getElementById("leaderboard-user-score");
  leaderboardUserName.textContent = currentUser;
  leaderboardUserScore.textContent = currentUserScore || 0;

  let leaderboardPlayers = Array.from(
    document.getElementsByClassName("leaderboard-player")
  );
  
  // Add user element
  leaderboardPlayers.push(document.getElementById("leaderboard-player-user"));
  
  // Sort based on score property (assuming dataset-score or similar)
  leaderboardPlayers.sort((a, b) => {
    const scoreA = Number(a.querySelector(".leaderboard-player-score").textContent);
    const scoreB = Number(b.querySelector(".leaderboard-player-score").textContent);
    return scoreB - scoreA;
  });
  
  // Re-append in new order (this changes the DOM visually)
  const container = document.getElementById("leaderboard-container");
  leaderboardPlayers.forEach(player => container.appendChild(player));
  
}
