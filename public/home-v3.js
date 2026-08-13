const params = new URLSearchParams(window.location.search);
      const plannerInputs = Array.from(document.querySelectorAll(".hero [data-planner-input]"));
      const plannerFeedback = document.querySelector("[data-planner-feedback]");

      function syncPlannerValue(value) {
        plannerInputs.forEach((input) => {
          if (input.value !== value) {
            input.value = value;
          }
          autoSizePlanner(input);
        });
      }

      function autoSizePlanner(input) {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 124)}px`;
      }

      plannerInputs.forEach((input) => {
        autoSizePlanner(input);
        input.addEventListener("input", (event) => syncPlannerValue(event.target.value));
      });

      document.querySelectorAll("[data-prompt-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          document.querySelectorAll("[data-prompt-chip]").forEach((item) => item.classList.remove("active"));
          chip.classList.add("active");
          const value = plannerInputs[0]?.value.trim();
          const addition = chip.dataset.promptChip;
          syncPlannerValue(value ? `${value}, ${addition}` : addition);
          plannerInputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
          if (plannerFeedback) plannerFeedback.textContent = "Press send to open the CUAC agent workspace.";
          plannerInputs[0]?.focus();
        });
      });

