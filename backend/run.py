#!/usr/bin/env python
if __name__ == "__main__":
    import uvicorn
    import main
    
    # Executar a aplicação
    uvicorn.run(
        main.app,
        host="0.0.0.0",
        port=8000
    )
