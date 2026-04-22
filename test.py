import os
from groq import Groq

client = Groq(api_key="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")

try:
    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role": "user", "content": "Explain UniShip architecture"}
        ],
    )
    print(completion.choices[0].message.content)

except Exception as e:
    print(f"Error: {e}")
