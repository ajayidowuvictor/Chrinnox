// set the theme before the page paints, so there is no flash
(function () {
	try {
		var p = localStorage.getItem("chrinnox-theme");
		var light = p === "light" || (p === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
		document.documentElement.setAttribute("data-theme", light ? "chrinnox-light" : "black");
	} catch (e) {}
})();
