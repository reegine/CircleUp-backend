const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:8000",
    setupNodeEvents(on, config) {
      const { execSync } = require("child_process");
      on("task", {
        runManagePy({ cmd }) {
          try {
            const output = execSync(`python manage.py ${cmd}`, { encoding: "utf8" });
            return output;
          } catch (err) {
            return err.message;
          }
        },
      });
    },
  },
});
