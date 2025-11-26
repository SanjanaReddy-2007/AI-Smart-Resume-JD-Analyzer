// ==== PDF PREVIEW ==== //
document.getElementById("resume").addEventListener("change", function () {
    document.getElementById("resumePreview").src = URL.createObjectURL(this.files[0]);
});

document.getElementById("jd").addEventListener("change", function () {
    document.getElementById("jdPreview").src = URL.createObjectURL(this.files[0]);
});

// ==== ANALYZE BUTTON CLICK ==== //
document.getElementById("analyzeBtn").addEventListener("click", async function () {

    let resume = document.getElementById("resume").files[0];
    let jd = document.getElementById("jd").files[0];

    if (!resume || !jd) {
        alert("Please upload both Resume and Job Description PDFs.");
        return;
    }

    let formData = new FormData();
    formData.append("resume", resume);
    formData.append("jd", jd);

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        // ==== DISPLAY RESULT SECTION ==== //
        document.getElementById("results").style.display = "block";
        document.getElementById("extraSections").style.display = "block";
        document.getElementById("exportPDF").style.display = "block";

        document.getElementById("exportPDF").style.display = "block";


        document.getElementById("matched").innerText = data.matched.join(", ");
        document.getElementById("missing").innerText = data.missing.join(", ");
        document.getElementById("similarity").innerText = data.similarity;

        // ==== PROGRESS BAR ==== //
        document.getElementById("progress").style.width = data.similarity + "%";
        document.getElementById("progress").innerText = data.similarity + "%";

        // ==== BAR GRAPH (Match Levels) ==== //
        const labels = data.semantic_matches.map(item => item.jd_skill);
        const levels = data.semantic_matches.map(item => item.match_level);

        if (window.skillChartInstance) {
            window.skillChartInstance.destroy();
        }

        const ctx = document.getElementById("skillChart").getContext("2d");
        window.skillChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Match Level (%)",
                    data: levels
                }]
            }
        });

        // ==== DONUT CHART BASED ON RESUME vs JD SKILLS ==== //

        // Resume & JD skills as sets
        const resumeSkills = new Set(data.resume_skills);
        const jdSkills = new Set(data.jd_skills);

        // Calculating categories
        const matchedCount = data.matched.length;
        const missingCount = data.missing.length;
        const extraResumeCount = resumeSkills.size - matchedCount;

        // Destroy old chart instance
        if (window.donutChartInstance) {
            window.donutChartInstance.destroy();
        }

        const dtx = document.getElementById("donutChart").getContext("2d");

        window.donutChartInstance = new Chart(dtx, {
            type: "doughnut",
            data: {
                labels: ["Matched", "Missing", "Extra Resume Skills"],
                datasets: [{
                    data: [matchedCount, missingCount, extraResumeCount],
                    backgroundColor: ["#28a745", "#dc3545", "#007bff"],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    title: {
                        display: true,
                        text: "Resume vs Job Description Skill Comparison",
                        font: { size: 16 }
                    }
                },
                cutout: "65%" // donut thickness
            }
        });



        // ==== SEMANTIC MAPPING TABLE (JD → Resume) ==== //
        let tableHTML = `
        <table class="table table-striped table-bordered mt-3">
            <thead>
                <tr>
                    <th>Job Description Skill</th>
                    <th>Closest Resume Skill</th>
                    <th>Match Level (%)</th>
                </tr>
            </thead>
            <tbody>
        `;

        data.semantic_matches.forEach(row => {
            let highlightClass = row.closest_resume_skill ? "" : "table-danger";

            tableHTML += `
                <tr class="${highlightClass}">
                    <td>${row.jd_skill}</td>
                    <td>${row.closest_resume_skill || "-"}</td>
                    <td>${row.match_level}%</td>
                </tr>
            `;
        });

        tableHTML += "</tbody></table>";

        document.getElementById("semanticTable").innerHTML = tableHTML;

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while analyzing.");
    }
});

document.getElementById("exportPDF").addEventListener("click", async function () {

    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF("p", "mm", "a4");
    let yOffset = 20;

    // ======== HEADER BAR ========
    pdf.setFillColor(28, 82, 150);
    pdf.rect(0, 0, 210, 20, "F");

    pdf.setFontSize(16);
    pdf.setTextColor(255, 255, 255);
    pdf.text("Skill Gap Analysis Report", 10, 13);

    pdf.setTextColor(0, 0, 0);

    // ======== SECTION TITLE STYLE ========
    function sectionTitle(title) {
        pdf.setFillColor(230, 240, 255);
        pdf.rect(10, yOffset, 190, 10, "F");
        pdf.setFontSize(14);
        pdf.text(title, 12, yOffset + 7);
        yOffset += 15;
    }

    // ======== CONTENT TEXT STYLE ========
    function textLine(text) {
        pdf.setFontSize(12);
        pdf.text(text, 12, yOffset);
        yOffset += 8;
    }

    // ======== SIMILARITY SCORE SECTION ========
    sectionTitle("Overall Match Summary");

    textLine("Similarity Score: " + document.getElementById("similarity").innerText + "%");
    textLine("Matching Skills: " + document.getElementById("matched").innerText);
    textLine("Missing Skills: " + (document.getElementById("missing").innerText || "None"));
    yOffset += 5;

    // ======== BAR CHART SECTION ========
    sectionTitle("Skill Match Level Chart");

    const chartCanvas = document.getElementById("skillChart");
    const chartImage = await html2canvas(chartCanvas).then(c => c.toDataURL("image/png"));

    const pageHeight = pdf.internal.pageSize.height;

    if (yOffset + 70 > pageHeight) {
        pdf.addPage();
        yOffset = 20;
    }

    pdf.addImage(chartImage, "PNG", 12, yOffset, 180, 60);
    yOffset += 70;

    // ======== DONUT CHART SECTION ========
    sectionTitle("Skill Distribution Donut Chart");

    const donutCanvas = document.getElementById("donutChart");
    const donutImage = await html2canvas(donutCanvas).then(c => c.toDataURL("image/png"));

    if (yOffset + 80 > pageHeight) {
        pdf.addPage();
        yOffset = 20;
    }

    pdf.addImage(donutImage, "PNG", 30, yOffset,60, 80);
    yOffset += 90;

    // ======== SEMANTIC TABLE SECTION ========
    sectionTitle("Semantic Skill Mapping Table");

    const tableElement = document.getElementById("semanticTable");
    const tableImage = await html2canvas(tableElement).then(c => c.toDataURL("image/png"));

    if (yOffset + 120 > pageHeight) {
        pdf.addPage();
        yOffset = 20;
    }

    pdf.addImage(tableImage, "PNG", 12, yOffset, 180, 0);

    // ======== FOOTER ========
    pdf.setFontSize(10);
    pdf.setTextColor(120);

    pdf.text("Generated by AI Skill Gap Analyzer", 10, 292);
    pdf.text("© 2025 Professional Report Format", 150, 292);

    pdf.save("Skill_Gap_Analysis_Report.pdf");
});
