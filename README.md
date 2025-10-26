<think>
The user wants me to format this into a README format so they can copy-paste it. The content is about the CircleUp Backend, a Django project.


## Structuring README Content  
- The task involves formatting content into a README.md file for the CircleUp Backend, a Django project.  
- The README needs to be structured for easy copy-paste and clarity.  

## Planning README Layout  
- Focusing on creating sections typical for a README, like project overview and setup instructions.  
- Ensuring the format is markdown-compatible for GitHub display.
</think># 🌀 CircleUp Backend

The CircleUp Backend is a Django REST Framework (DRF) project that powers the CircleUp app — a social event and community platform. It handles authentication, event management, and user data securely.

## 🚀 Features

- User authentication using JWT (SimpleJWT)
- Event CRUD (create, read, update, delete)
- User profiles and participation management
- Admin dashboard
- Secure .env configuration support

## ⚙️ Prerequisites

Make sure you have installed:

- Python 3.10+
- pip
- Git

## 🧩 Setup Instructions

1. Clone the repository
   ```
   git clone https://github.com/reegine/CircleUp-backend.git
   cd CircleUp-backend
   ```

2. Activate the virtual environment

   If a virtual environment (venv) already exists in the project, activate it:

   🪟 Windows (PowerShell)
   ```
   venv\Scripts\activate
   ```

   🐧 macOS / Linux
   ```
   source venv/bin/activate
   ```

3. Install dependencies

   Once the virtual environment is active, install all required packages:
   ```
   pip install -r requirements.txt
   ```

4. Set up environment variables

   Create a .env file in the project root directory and add your configuration (ask me for the .env content):
   ```
   SECRET_KEY=your-django-secret-key
   DEBUG=True
   ALLOWED_HOSTS=127.0.0.1,localhost
   DATABASE_URL=sqlite:///db.sqlite3

   # Optional: Firebase / Google credentials
   # GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-credentials.json
   ```

   ⚠️ Important: Do not commit your .env file or credentials to GitHub.

5. Apply database migrations
   ```
   python manage.py makemigrations
   python manage.py migrate
   ```

6. (Optional) Create a superuser
   ```
   python manage.py createsuperuser
   ```

7. Run the development server
   ```
   python manage.py runserver
   ```

   Open your browser at:
   👉 http://127.0.0.1:8000/

## 🔐 Authentication

This project uses SimpleJWT for authentication.

Include the token in your request headers:

```
Authorization: Bearer <your_token>
```

## 🧠 API Access

You can explore the API using the Django REST Framework’s browsable interface at:

http://127.0.0.1:8000/api/

## 🧰 Useful Commands

| Command                      | Description                  |
|------------------------------|------------------------------|
| python manage.py runserver   | Run local development server |
| python manage.py makemigrations | Create new migrations       |
| python manage.py migrate     | Apply database migrations   |
| python manage.py createsuperuser | Create an admin account     |

