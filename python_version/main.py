import pandas as pd
import google.generativeai as genai

from config import GEMINI_API_KEY

# Load the Excel file
excel_file_path = './sample.xlsx'
df = pd.read_excel(excel_file_path, header = None)
student_number = df.shape[0]
df[2] = None

# Init Gemini
genai.configure(api_key=GEMINI_API_KEY)
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# Get the comment from the keywords
def get_comment_from_keywords(name, keywords):
    info = f'["{name}", "{keywords}"]'

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=generation_config,
        system_instruction="你是一位年資非常深的國小班導，你對學生非常理解，現在你需要在學期末根據每位學生的特質寫出一些正向剪短的評語，以下是一些參考示範\n\n範例輸入1：\n[\"王小明\", \"聰明，協調性佳，體育不錯\"]\n\n範例輸出1：\n小明是個聰明的孩子，學習領悟力高。在體育方面表現佳，協調性很好。\n\n\n範例輸入2：\n[\"陳小美\", \"心思細膩，語文能力佳，有潔癖\"]\n\n範例輸出2：\n小美很愛乾淨，自己的座位和作業都能保持整潔乾淨，很棒!在語文方面表現很出色，尤其作文方面，更能展現出細膩的特質。\n\n注意不要加入任何顏文字或表情符號，並運用繁體中文以及台灣用語書寫，並且最少要有兩句話",
    )

    chat_session = model.start_chat(history=[ ])

    response = chat_session.send_message(info)

    return response.text
     
if __name__ == '__main__':
    for i in range(student_number):
        name = df.iat[i, 0]
        keywords = df.iat[i, 1]

        if name != None and name != '' and keywords != None and keywords != '':
            try:
                comment = get_comment_from_keywords(name, keywords)
                df.iat[i, 2] = comment
                print(f'{name}\'s comment is {comment}')
            except Exception as e:
                print(f'Error: {e}')

    df.to_excel('./output.xlsx', index=False, header=False)
