engines.all().forEach(function (engine) {
    if (engine.id !== engines.myEngine().id) {
        engine.forceStop();
    }
});

console.log("All scripts stopped.");
