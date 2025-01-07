from flask import Flask, request

app = Flask(__name__)

@app.route("/", methods=["POST"])
def home():
    nama = request.form.get("nama")  # Ambil input nama dari borang
    umur = request.form.get("umur")  # Ambil input umur dari borang
    # Hasilkan HTML terus di dalam Flask
    return f"""
    <!DOCTYPE html>
    <html lang="ms">
    <head>
        <meta charset="UTF-8">
        <title>Maklumat Anda</title>
    </head>
    <body>
        <h1>Selamat Datang, {nama}!</h1>
        <p>Umur anda ialah {umur} tahun.</p>
        <a href="/">Kembali ke Borang</a> <!-- Link untuk kembali ke borang -->
    </body>
    </html>
    """

@app.route("/", methods=["GET"])
def borang():
    return """
    <!DOCTYPE html>
    <html lang="ms">
    <head>
        <meta charset="UTF-8">
        <title>Borang</title>
    </head>
    <body>
        <h1>Masukkan Maklumat Anda</h1>
        <form action="/" method="post">
            Nama: <input type="text" name="nama" required><br><br>
            Umur: <input type="number" name="umur" required><br><br>
            <button type="submit">Hantar</button>
        </form>
    </body>
    </html>
    """

if __name__ == "__main__":
    app.run(debug=True)
