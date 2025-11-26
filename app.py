from flask import Flask, render_template, request, jsonify, redirect, session
import PyPDF2
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__)
app.secret_key = "yoursecretkey"


users = {}

# ---------------------------
# LOAD BERT MODEL
# ---------------------------
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

SKILLS = [
    "python","java","c","c++","sql","mysql","mongodb","javascript","html","css",
    "react","node","django","flask","machine learning","deep learning",
    "data analysis","excel","power bi","tableau","nlp","data science",
    "communication","teamwork","leadership","project management","azure",
    "tensorflow","pandas","numpy","matplotlib","git","github","linux"
]

# ---------------------------
# PDF READER
# ---------------------------
def read_pdf(file):
    text = ""
    reader = PyPDF2.PdfReader(file)
    for page in reader.pages:
        content = page.extract_text()
        if content:
            text += content + " "
    return text

# ---------------------------
# GET EMBEDDING VECTOR
# ---------------------------
def get_embedding(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
    with torch.no_grad():
        outputs = model(**inputs)
    return outputs.last_hidden_state[:, 0, :].numpy()

# ---------------------------
# SKILL EXTRACTION
# ---------------------------
def extract_skills(text):
    found = set()
    text_lower = text.lower()
    for skill in SKILLS:
        if skill in text_lower:
            found.add(skill)
    return found

# ---------------------------
# AUTH ROUTES
# ---------------------------
@app.route("/")
def home():
    if "user" not in session:
        return redirect("/login")
    return render_template("dashboard.html", title="Dashboard")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]

        if email in users and check_password_hash(users[email]["password"], password):
            session["user"] = users[email]["name"]
            return redirect("/")
        return "Invalid Credentials"

    return render_template("login.html", title="Login")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = generate_password_hash(request.form["password"])

        if email in users:
            return "User Already Exists"

        users[email] = {"name": name, "password": password}
        return redirect("/login")

    return render_template("register.html", title="Register")

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# ---------------------------
# SKILL GAP ANALYSIS
# ---------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    if "user" not in session:
        return jsonify({"error": "Login required"}), 401

    if "resume" not in request.files or "jd" not in request.files:
        return jsonify({"error": "Upload both files"}), 400

    resume_file = request.files["resume"]
    jd_file = request.files["jd"]

    resume_text = read_pdf(resume_file)
    jd_text = read_pdf(jd_file)

    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)

    matched = sorted(list(resume_skills.intersection(jd_skills)))
    missing = sorted(list(jd_skills - resume_skills))

    # overall similarity
    resume_emb = get_embedding(" ".join(resume_skills)) if resume_skills else np.zeros((1,384))
    jd_emb = get_embedding(" ".join(jd_skills)) if jd_skills else np.zeros((1,384))

    similarity = float(cosine_similarity(resume_emb, jd_emb)[0][0])
    similarity = round(similarity * 100, 2)

    # semantic match table
    resume_skill_list = list(resume_skills)
    jd_skill_list = list(jd_skills)
    semantic_matches = []

    for j_skill in jd_skill_list:
        j_emb = get_embedding(j_skill)
        best_match = None
        best_score = -1

        for r_skill in resume_skill_list:
            r_emb = get_embedding(r_skill)
            sim = float(cosine_similarity(j_emb, r_emb)[0][0])

            if sim > best_score:
                best_score = sim
                best_match = r_skill

        semantic_matches.append({
            "jd_skill": j_skill,
            "closest_resume_skill": best_match,
            "match_level": round(best_score * 100, 2)
        })



    return jsonify({
        "matched": matched,
        "missing": missing,
        "similarity": similarity,
        "semantic_matches": semantic_matches
    })

# ---------------------------
# RUN APP
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True)
